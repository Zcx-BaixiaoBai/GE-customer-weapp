import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { databaseService } from '../../database/database.service';

// JSON 文件路径（降级用）
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const ORG_FILE = path.join(DATA_DIR, 'org_nodes.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ONBOARDING_FILE = path.join(DATA_DIR, 'onboarding_items.json');
// 跨模块数据（只读）：由 training / exam 模块维护的 JSON 降级文件
const COURSES_JSON = path.join(DATA_DIR, 'courses.json');
const LEARNING_RECORDS_JSON = path.join(DATA_DIR, 'learning_records.json');
const EXAMS_JSON = path.join(DATA_DIR, 'exams.json');
const EXAM_SUBMISSIONS_JSON = path.join(DATA_DIR, 'exam_submissions.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORG_FILE)) fs.writeFileSync(ORG_FILE, '[]');
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  if (!fs.existsSync(ONBOARDING_FILE)) fs.writeFileSync(ONBOARDING_FILE, '[]');
}

function readJson(file: string): any[] {
  ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) || []; } catch { return []; }
}

function writeJson(file: string, data: any[]): void {
  ensureDataFiles();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function genId(prefix: string): string {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

export interface OrgNode {
  id: string;
  parentId: string | null;
  nodeType: string;        // project | floor | tenant | 自定义
  name: string;
  code: string;
  level: number;
  sortOrder: number;
  createdAt: string;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  avatar: string;
  orgNodeId: string | null;
  position: string;
  role: string;            // manager(店长) | employee(员工)
  status: string;          // active | inactive
  createdAt: string;
}

export interface OnboardingItem {
  id: string;
  itemType: string;        // course | exam
  itemId: string;
  sortOrder: number;
  createdAt: string;
}

// 节点类型标签
const NODE_TYPE_LABELS: Record<string, string> = {
  project: '项目',
  floor: '楼层',
  tenant: '租户',
};

function nodeTypeLabel(t: string): string {
  return NODE_TYPE_LABELS[t] || t;
}

/**
 * 组织架构服务
 * - 自定义架构树（项目 → 楼层 → 租户，可扩展）
 * - 用户（租户员工）管理
 * - 入职必修项管理
 * - 按架构维度的学习/入职统计
 */
export class OrgService {
  private readonly logger = new Logger(OrgService.name);
  private useDb = false;

  constructor() {
    this.initDb();
  }

  private async initDb() {
    try {
      const healthy = await databaseService.isHealthy();
      this.useDb = healthy;
      if (healthy) {
        this.logger.log('组织架构模块使用 MySQL 存储');
        // 自愈：为旧版 users 表补 role 列（CREATE TABLE 已含，旧库可能没有）
        await this.ensureRoleColumn();
      } else {
        this.logger.warn('MySQL 不可用，降级为 JSON 文件存储');
      }
    } catch (e) {
      this.logger.warn('MySQL 初始化失败，降级JSON: ' + e.message);
      this.useDb = false;
    }
  }

  /**
   * 自愈：检查 users 表是否有 role 列，没有则补上（兼容旧库）
   */
  private async ensureRoleColumn(): Promise<void> {
    try {
      const cols = await databaseService.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'`
      );
      if (!cols || cols.length === 0) {
        await databaseService.query(
          `ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'employee' AFTER position`
        );
        this.logger.log('已为 users 表补充 role 列');
      }
    } catch (e) {
      this.logger.warn('检查/补充 role 列失败: ' + e.message);
    }
  }

  // ========== 组织架构 CRUD ==========

  async getTree(): Promise<any[]> {
    const nodes = await this.getAllNodes();
    return this.buildTree(nodes);
  }

  async getAllNodes(): Promise<OrgNode[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM org_nodes ORDER BY level, sort_order, created_at');
        return rows.map(this.mapOrgRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    return readJson(ORG_FILE).map(this.mapOrgJson);
  }

  async createNode(data: Partial<OrgNode>): Promise<OrgNode> {
    const id = genId('ORG');
    const parentId = data.parentId || null;
    // 计算层级：有父节点则取父节点 level+1，否则为 0
    let level = 0;
    if (parentId) {
      const parent = await this.getNodeById(parentId);
      if (!parent) throw new Error('父节点不存在');
      level = parent.level + 1;
    }
    const node: OrgNode = {
      id,
      parentId,
      nodeType: data.nodeType || 'tenant',
      name: data.name || '未命名节点',
      code: data.code || '',
      level,
      sortOrder: data.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO org_nodes (id, parent_id, node_type, name, code, level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, parentId, node.nodeType, node.name, node.code, node.level, node.sortOrder]
        );
        return node;
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const nodes = readJson(ORG_FILE);
    nodes.push(this.toOrgJson(node));
    writeJson(ORG_FILE, nodes);
    return node;
  }

  async updateNode(id: string, data: Partial<OrgNode>): Promise<OrgNode | null> {
    if (this.useDb) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
        if (data.nodeType !== undefined) { fields.push('node_type = ?'); values.push(data.nodeType); }
        if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
        if (fields.length > 0) {
          values.push(id);
          await databaseService.query(`UPDATE org_nodes SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        const rows = await databaseService.query('SELECT * FROM org_nodes WHERE id = ?', [id]);
        return rows.length > 0 ? this.mapOrgRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL更新失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const nodes = readJson(ORG_FILE);
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    nodes[idx] = { ...nodes[idx], ...data, id };
    writeJson(ORG_FILE, nodes);
    return this.mapOrgJson(nodes[idx]);
  }

  async deleteNode(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM org_nodes WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    // JSON 降级：递归删除子节点
    const nodes = readJson(ORG_FILE);
    const toDelete = this.collectDescendantIds(nodes, id);
    const remaining = nodes.filter((n) => !toDelete.includes(n.id));
    writeJson(ORG_FILE, remaining);
    // 同时解绑该节点下的用户
    const users = readJson(USERS_FILE);
    users.forEach((u) => { if (toDelete.includes(u.orgNodeId)) u.orgNodeId = null; });
    writeJson(USERS_FILE, users);
    return toDelete.includes(id);
  }

  async getNodeById(id: string): Promise<OrgNode | null> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM org_nodes WHERE id = ?', [id]);
        return rows.length > 0 ? this.mapOrgRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const nodes = readJson(ORG_FILE);
    const n = nodes.find((x) => x.id === id);
    return n ? this.mapOrgJson(n) : null;
  }

  // ========== 用户（租户员工）CRUD ==========

  async getUsers(orgNodeId?: string): Promise<User[]> {
    let users: User[];
    if (this.useDb) {
      try {
        const rows = orgNodeId
          ? await databaseService.query('SELECT * FROM users WHERE org_node_id = ? ORDER BY created_at DESC', [orgNodeId])
          : await databaseService.query('SELECT * FROM users ORDER BY created_at DESC');
        users = rows.map(this.mapUserRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
        users = readJson(USERS_FILE).map(this.mapUserJson);
      }
    } else {
      users = readJson(USERS_FILE).map(this.mapUserJson);
      if (orgNodeId) users = users.filter((u) => u.orgNodeId === orgNodeId);
    }
    return users;
  }

  /**
   * 获取某节点（含其所有子孙节点）下的全部用户
   */
  async getUsersUnderNode(nodeId: string): Promise<User[]> {
    const allNodes = await this.getAllNodes();
    const descendantIds = this.collectDescendantIds(allNodes, nodeId);
    let users: User[];
    if (this.useDb) {
      try {
        if (descendantIds.length === 0) return [];
        const placeholders = descendantIds.map(() => '?').join(',');
        const rows = await databaseService.query(
          `SELECT * FROM users WHERE org_node_id IN (${placeholders}) ORDER BY created_at DESC`,
          descendantIds
        );
        users = rows.map(this.mapUserRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
        users = readJson(USERS_FILE)
          .filter((u) => descendantIds.includes(u.orgNodeId))
          .map(this.mapUserJson);
      }
    } else {
      users = readJson(USERS_FILE)
        .filter((u) => descendantIds.includes(u.orgNodeId))
        .map(this.mapUserJson);
    }
    return users;
  }

  async createUser(data: Partial<User>): Promise<User> {
    const id = genId('USR');
    const phone = (data.phone || '').trim();
    if (!phone) throw new Error('手机号不能为空');

    // 手机号唯一性校验
    const existing = await this.getUserByPhone(phone);
    if (existing) throw new Error('该手机号已存在');

    const user: User = {
      id,
      phone,
      name: data.name || '',
      avatar: data.avatar || '',
      orgNodeId: data.orgNodeId || null,
      position: data.position || '',
      role: data.role || 'employee',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO users (id, phone, name, avatar, org_node_id, position, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, user.phone, user.name, user.avatar, user.orgNodeId, user.position, user.role, user.status]
        );
        return user;
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const users = readJson(USERS_FILE);
    users.push(this.toUserJson(user));
    writeJson(USERS_FILE, users);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    if (this.useDb) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.avatar !== undefined) { fields.push('avatar = ?'); values.push(data.avatar); }
        if (data.orgNodeId !== undefined) { fields.push('org_node_id = ?'); values.push(data.orgNodeId); }
        if (data.position !== undefined) { fields.push('position = ?'); values.push(data.position); }
        if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
        if (fields.length > 0) {
          values.push(id);
          await databaseService.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        const rows = await databaseService.query('SELECT * FROM users WHERE id = ?', [id]);
        return rows.length > 0 ? this.mapUserRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL更新失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const users = readJson(USERS_FILE);
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...data, id };
    writeJson(USERS_FILE, users);
    return this.mapUserJson(users[idx]);
  }

  async deleteUser(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM users WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const users = readJson(USERS_FILE);
    const filtered = users.filter((u) => u.id !== id);
    writeJson(USERS_FILE, filtered);
    return filtered.length < users.length;
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM users WHERE phone = ?', [phone]);
        return rows.length > 0 ? this.mapUserRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const users = readJson(USERS_FILE);
    const u = users.find((x) => x.phone === phone);
    return u ? this.mapUserJson(u) : null;
  }

  // ========== 小程序端：租户选择 / 店长视图 ==========

  /**
   * 列出所有租户节点（小程序「选择租户」页用）
   * 返回扁平列表，带父级路径（项目/楼层）便于展示
   */
  async getTenants(): Promise<any[]> {
    const allNodes = await this.getAllNodes();
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    return allNodes
      .filter((n) => n.nodeType === 'tenant')
      .map((n) => {
        // 拼接父级路径：项目 / 楼层
        const path: string[] = [];
        let cur = n.parentId ? nodeMap.get(n.parentId) : null;
        while (cur) {
          path.unshift(cur.name);
          cur = cur.parentId ? nodeMap.get(cur.parentId) : null;
        }
        return {
          id: n.id,
          name: n.name,
          code: n.code,
          path: path.join(' / ') || '—',
          createdAt: n.createdAt,
        };
      });
  }

  /**
   * 小程序登录时绑定/切换租户（手机号 ⇄ 店铺，双向可改）
   * - mode='join'：加入已有租户，成为员工（role=employee）
   * - mode='create'：新建租户，当前用户成为店长（role=manager）
   * 已注册用户重新选择 = 更新其租户绑定（换店），与后台分配双向一致
   */
  async registerUser(params: {
    phone: string;
    name?: string;
    mode: 'create' | 'join';
    tenantId?: string;          // join 模式必填
    tenantName?: string;        // create 模式必填
    parentNodeId?: string;      // create 模式可选，指定父楼层；缺省自动选合适的父节点
    position?: string;
  }): Promise<User> {
    const phone = (params.phone || '').trim();
    if (!phone) throw new Error('手机号不能为空');

    const existing = await this.getUserByPhone(phone);

    if (params.mode === 'join') {
      if (!params.tenantId) throw new Error('加入租户需提供 tenantId');
      const tenant = await this.getNodeById(params.tenantId);
      if (!tenant || tenant.nodeType !== 'tenant') throw new Error('租户不存在');
      const patch: Partial<User> = {
        orgNodeId: params.tenantId, role: 'employee',
      };
      if (params.name) patch.name = params.name;
      if (params.position) patch.position = params.position;
      // 已注册 → 更新绑定（换店）；未注册 → 新建
      if (existing) {
        const updated = await this.updateUser(existing.id, patch);
        return updated || existing;
      }
      return this.createUser({ phone, name: params.name || '', orgNodeId: params.tenantId, position: params.position || '', role: 'employee' });
    }

    // create 模式：新建租户节点，需确定父节点
    if (!params.tenantName || !params.tenantName.trim()) throw new Error('请输入租户名称');
    const allNodes = await this.getAllNodes();
    let parentId = params.parentNodeId || null;
    if (!parentId) {
      // 自动选父节点：优先第一个楼层 → 否则第一个项目 → 否则新建默认项目
      const firstFloor = allNodes.find((n) => n.nodeType === 'floor');
      if (firstFloor) {
        parentId = firstFloor.id;
      } else {
        const firstProject = allNodes.find((n) => n.nodeType === 'project');
        if (firstProject) {
          parentId = firstProject.id;
        } else {
          // 没有任何项目，新建一个默认项目作为根
          const proj = await this.createNode({ nodeType: 'project', name: '默认项目' });
          parentId = proj.id;
        }
      }
    }
    const tenant = await this.createNode({
      parentId, nodeType: 'tenant', name: params.tenantName.trim(),
    });
    const patch: Partial<User> = {
      orgNodeId: tenant.id, role: 'manager', position: params.position || '店长',
    };
    if (params.name) patch.name = params.name;
    // 已注册 → 更新为新店店长（离开原店）；未注册 → 新建
    if (existing) {
      const updated = await this.updateUser(existing.id, patch);
      return updated || existing;
    }
    return this.createUser({ phone, name: params.name || '', orgNodeId: tenant.id, position: params.position || '店长', role: 'manager' });
  }

  /**
   * 小程序：当前用户档案（含租户信息、角色），用于判断是否已选租户
   */
  async getMyProfile(phone: string): Promise<any> {
    const user = await this.getUserByPhone(phone);
    if (!user) return { registered: false };
    let tenant: any = null;
    if (user.orgNodeId) {
      const node = await this.getNodeById(user.orgNodeId);
      if (node) tenant = { id: node.id, name: node.name, code: node.code, nodeType: node.nodeType };
    }
    return {
      registered: true,
      user: {
        id: user.id, phone: user.phone, name: user.name,
        position: user.position, role: user.role, status: user.status,
      },
      tenant,
      isManager: user.role === 'manager',
    };
  }

  /**
   * 店长视图：本店所有员工的学习/入职情况
   * 仅店长（role=manager）可访问；复用 getOnboardingNodeDetail 聚合
   */
  async getMyStore(phone: string): Promise<any> {
    const user = await this.getUserByPhone(phone);
    if (!user) throw new Error('用户未注册，请先选择租户');
    if (user.role !== 'manager') throw new Error('仅店长可查看本店学习情况');
    if (!user.orgNodeId) throw new Error('未关联租户');

    const detail = await this.getOnboardingNodeDetail(user.orgNodeId);
    return {
      ...detail,
      manager: { name: user.name, phone: user.phone, position: user.position },
    };
  }

  // ========== 入职必修项管理 ==========

  async getOnboardingItems(): Promise<OnboardingItem[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query('SELECT * FROM onboarding_items ORDER BY sort_order, created_at');
        return rows.map(this.mapOnboardingRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    return readJson(ONBOARDING_FILE).map(this.mapOnboardingJson);
  }

  async addOnboardingItem(itemType: string, itemId: string): Promise<OnboardingItem> {
    if (!['course', 'exam'].includes(itemType)) throw new Error('item_type 必须是 course 或 exam');
    if (!itemId) throw new Error('item_id 不能为空');

    const id = genId('OB');
    const item: OnboardingItem = {
      id, itemType, itemId, sortOrder: 0, createdAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO onboarding_items (id, item_type, item_id, sort_order) VALUES (?, ?, ?, ?)',
          [id, itemType, itemId, 0]
        );
        return item;
      } catch (e: any) {
        // 唯一键冲突说明已存在，直接返回已存在项
        if (e && (e.code === 'ER_DUP_ENTRY' || (e.message || '').includes('Duplicate'))) {
          const rows = await databaseService.query(
            'SELECT * FROM onboarding_items WHERE item_type = ? AND item_id = ?', [itemType, itemId]
          );
          return rows.length > 0 ? this.mapOnboardingRow(rows[0]) : item;
        }
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const items = readJson(ONBOARDING_FILE);
    if (!items.find((x) => x.itemType === itemType && x.itemId === itemId)) {
      items.push(this.toOnboardingJson(item));
      writeJson(ONBOARDING_FILE, items);
    }
    return item;
  }

  async removeOnboardingItem(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM onboarding_items WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const items = readJson(ONBOARDING_FILE);
    const filtered = items.filter((x) => x.id !== id);
    writeJson(ONBOARDING_FILE, filtered);
    return filtered.length < items.length;
  }

  // ========== 按架构维度的统计 ==========

  /**
   * 入职完成统计 —— 整棵架构树，每个节点带其下属员工的入职完成情况
   * 一个用户「完成入职」= 所有入职课程全部学完 + 所有入职考试全部通过
   */
  async getOnboardingTreeStats(): Promise<any> {
    try {
      const [nodes, users, onboardingItems] = await Promise.all([
        this.getAllNodes(),
        this.getUsers(),
        this.getOnboardingItems(),
      ]);

      const statusByPhone = await this.computeOnboardingStatusBatch(
        users.map((u) => u.phone), onboardingItems
      );

      // phone -> orgNodeId
      const userOrgMap = new Map<string, string | null>();
      for (const u of users) userOrgMap.set(u.phone, u.orgNodeId);

      // 节点 -> 其下所有用户手机号（含子孙）
      const nodeDescendants = new Map<string, string[]>();
      for (const n of nodes) {
        const descIds = this.collectDescendantIds(nodes, n.id);
        const phones = users.filter((u) => u.orgNodeId && descIds.includes(u.orgNodeId)).map((u) => u.phone);
        nodeDescendants.set(n.id, phones);
      }

      // 聚合每个节点（含子孙）：入职完成 + 学习时长 + 考试次数
      const statsMap = new Map<string, any>();
      for (const n of nodes) {
        const phones = nodeDescendants.get(n.id) || [];
        let completed = 0, totalDuration = 0, totalAttempts = 0;
        for (const p of phones) {
          const st = statusByPhone.get(p);
          if (!st) continue;
          if (st.onboardingCompleted) completed++;
          totalDuration += st.totalWatchedDuration || 0;
          totalAttempts += st.examAttempts || 0;
        }
        statsMap.set(n.id, {
          userCount: phones.length,
          completedCount: completed,
          completionRate: phones.length > 0 ? Math.round((completed / phones.length) * 100) : 0,
          totalWatchedDuration: totalDuration,
          totalExamAttempts: totalAttempts,
        });
      }

      const tree = this.buildTree(nodes).map((n) => this.attachStats(n, statsMap));

      // 全局汇总
      let totalUsers = 0, totalCompleted = 0, totalDuration = 0, totalAttempts = 0;
      for (const u of users) {
        const st = statusByPhone.get(u.phone);
        if (st) {
          totalUsers++;
          if (st.onboardingCompleted) totalCompleted++;
          totalDuration += st.totalWatchedDuration || 0;
          totalAttempts += st.examAttempts || 0;
        }
      }
      const courseItems = onboardingItems.filter((i) => i.itemType === 'course').length;
      const examItems = onboardingItems.filter((i) => i.itemType === 'exam').length;

      return {
        nodes: tree,
        summary: {
          totalUsers,
          completedCount: totalCompleted,
          completionRate: totalUsers > 0 ? Math.round((totalCompleted / totalUsers) * 100) : 0,
          totalWatchedDuration: totalDuration,
          totalExamAttempts: totalAttempts,
          onboardingCourses: courseItems,
          onboardingExams: examItems,
          hasRequirements: (courseItems + examItems) > 0,
        },
      };
    } catch (e) {
      this.logger.warn('入职统计查询失败: ' + e.message);
      return { nodes: [], summary: { totalUsers: 0, completedCount: 0, completionRate: 0, hasRequirements: false } };
    }
  }

  /**
   * 某架构节点的入职明细 —— 节点下每个用户的入职完成情况 + 学习/考试摘要
   */
  async getOnboardingNodeDetail(nodeId: string): Promise<any> {
    try {
      const node = await this.getNodeById(nodeId);
      if (!node) return { node: null, onboardingItems: [], users: [], summary: { totalUsers: 0, completedCount: 0, completionRate: 0 } };

      const [users, onboardingItems] = await Promise.all([
        this.getUsersUnderNode(nodeId),
        this.getOnboardingItems(),
      ]);

      const phones = users.map((u) => u.phone);
      const statusByPhone = await this.computeOnboardingStatusBatch(phones, onboardingItems);

      const userDetails = users.map((u) => {
        const st = statusByPhone.get(u.phone) || {
          coursesCompleted: 0, coursesTotal: 0, examsPassed: 0, examsTotal: 0,
          onboardingCompleted: false, courseDetails: [], examDetails: [],
        };
        return {
          id: u.id, phone: u.phone, name: u.name, position: u.position,
          orgNodeId: u.orgNodeId, status: u.status,
          coursesCompleted: st.coursesCompleted, coursesTotal: st.coursesTotal,
          examsPassed: st.examsPassed, examsTotal: st.examsTotal,
          onboardingCompleted: st.onboardingCompleted,
          totalWatchedDuration: st.totalWatchedDuration,
          examAttempts: st.examAttempts,
        };
      });

      let completed = 0;
      for (const u of userDetails) if (u.onboardingCompleted) completed++;

      // 入职项明细（带标题）
      const itemDetails = await this.enrichOnboardingItems(onboardingItems);

      return {
        node: {
          id: node.id, name: node.name, nodeType: node.nodeType,
          nodeTypeLabel: nodeTypeLabel(node.nodeType),
          code: node.code, level: node.level,
        },
        onboardingItems: itemDetails,
        users: userDetails,
        summary: {
          totalUsers: userDetails.length,
          completedCount: completed,
          completionRate: userDetails.length > 0 ? Math.round((completed / userDetails.length) * 100) : 0,
        },
      };
    } catch (e) {
      this.logger.warn('节点入职明细查询失败: ' + e.message);
      return { node: null, onboardingItems: [], users: [], summary: { totalUsers: 0, completedCount: 0, completionRate: 0 } };
    }
  }

  /**
   * 批量计算多个手机号的入职完成状态（一次查全量数据，内存聚合）
   */
  private async computeOnboardingStatusBatch(
    phones: string[], onboardingItems: OnboardingItem[]
  ): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    if (phones.length === 0) return result;

    const courseItems = onboardingItems.filter((i) => i.itemType === 'course');
    const examItems = onboardingItems.filter((i) => i.itemType === 'exam');
    const hasRequirements = courseItems.length + examItems.length > 0;

    // 无入职要求：每个用户标记为「无要求」
    if (!hasRequirements) {
      for (const p of phones) {
        result.set(p, {
          coursesCompleted: 0, coursesTotal: 0, examsPassed: 0, examsTotal: 0,
          onboardingCompleted: false, hasRequirements: false,
          totalWatchedDuration: 0, examAttempts: 0,
          courseDetails: [], examDetails: [],
        });
      }
      return result;
    }

    const courseIds = courseItems.map((i) => i.itemId);
    const examIds = examItems.map((i) => i.itemId);

    // 加载统计所需数据（DB 优先，降级用 training/exam 模块维护的 JSON 文件）
    const lessonsByCourse = new Map<string, number>();
    const courseTitleMap = new Map<string, string>();
    const examTitleMap = new Map<string, string>();
    const recordsByCoursePhone = new Map<string, Set<string>>(); // courseId|phone -> 已完成课时id集合
    const durationByPhone = new Map<string, number>();
    const examSubsByPhone = new Map<string, any[]>();
    const attemptsByPhone = new Map<string, number>();

    if (this.useDb) {
      const ph = phones.map(() => '?').join(',');
      if (courseIds.length > 0) {
        const cp = courseIds.map(() => '?').join(',');
        const lessonRows = await databaseService.query(
          `SELECT course_id, COUNT(*) as cnt FROM lessons WHERE course_id IN (${cp}) GROUP BY course_id`, courseIds
        );
        for (const r of lessonRows) lessonsByCourse.set(r.course_id, r.cnt);
        const courseRows = await databaseService.query(`SELECT id, title FROM courses WHERE id IN (${cp})`, courseIds);
        for (const r of courseRows) courseTitleMap.set(r.id, r.title);
      }
      if (examIds.length > 0) {
        const ep = examIds.map(() => '?').join(',');
        const examRows = await databaseService.query(`SELECT id, title FROM exams WHERE id IN (${ep})`, examIds);
        for (const r of examRows) examTitleMap.set(r.id, r.title);
      }
      const recRows = await databaseService.query(
        `SELECT course_id, lesson_id, phone, completed, watched_duration FROM learning_records WHERE phone IN (${ph})`, phones
      );
      for (const r of recRows) {
        durationByPhone.set(r.phone, (durationByPhone.get(r.phone) || 0) + (r.watched_duration || 0));
        if (r.completed) {
          const key = r.course_id + '|' + r.phone;
          if (!recordsByCoursePhone.has(key)) recordsByCoursePhone.set(key, new Set());
          recordsByCoursePhone.get(key).add(r.lesson_id);
        }
      }
      const subRows = await databaseService.query(
        `SELECT exam_id, phone, passed FROM exam_submissions WHERE phone IN (${ph})`, phones
      );
      for (const r of subRows) {
        if (!examSubsByPhone.has(r.phone)) examSubsByPhone.set(r.phone, []);
        examSubsByPhone.get(r.phone).push(r);
        attemptsByPhone.set(r.phone, (attemptsByPhone.get(r.phone) || 0) + 1);
      }
    } else {
      // JSON 降级：从 training/exam 模块维护的 JSON 文件读取
      const coursesJson = readJson(COURSES_JSON);
      const examsJson = readJson(EXAMS_JSON);
      const recsJson = readJson(LEARNING_RECORDS_JSON);
      const subsJson = readJson(EXAM_SUBMISSIONS_JSON);
      for (const c of coursesJson) {
        if (courseIds.includes(c.id)) {
          courseTitleMap.set(c.id, c.title);
          lessonsByCourse.set(c.id, (c.lessons || []).length);
        }
      }
      for (const e of examsJson) {
        if (examIds.includes(e.id)) examTitleMap.set(e.id, e.title);
      }
      for (const r of recsJson) {
        if (!phones.includes(r.phone)) continue;
        durationByPhone.set(r.phone, (durationByPhone.get(r.phone) || 0) + (r.watchedDuration || 0));
        if (r.completed) {
          const key = r.courseId + '|' + r.phone;
          if (!recordsByCoursePhone.has(key)) recordsByCoursePhone.set(key, new Set());
          recordsByCoursePhone.get(key).add(r.lessonId);
        }
      }
      for (const s of subsJson) {
        if (!phones.includes(s.phone)) continue;
        // 归一化为与 DB 一致的字段名，供下方聚合使用
        const norm = { exam_id: s.examId, phone: s.phone, passed: s.passed };
        if (!examSubsByPhone.has(s.phone)) examSubsByPhone.set(s.phone, []);
        examSubsByPhone.get(s.phone).push(norm);
        attemptsByPhone.set(s.phone, (attemptsByPhone.get(s.phone) || 0) + 1);
      }
    }

    for (const phone of phones) {
      // 课程完成情况
      const courseDetails = [];
      let coursesCompleted = 0;
      for (const ci of courseItems) {
        const totalLessons = lessonsByCourse.get(ci.itemId) || 0;
        const key = ci.itemId + '|' + phone;
        const completedLessonSet = recordsByCoursePhone.get(key);
        const completedLessons = completedLessonSet ? completedLessonSet.size : 0;
        // 课程学完 = 有课时 且 全部课时已完成
        const courseCompleted = totalLessons > 0 && completedLessons >= totalLessons;
        if (courseCompleted) coursesCompleted++;
        courseDetails.push({
          itemId: ci.itemId,
          title: courseTitleMap.get(ci.itemId) || '已删除课程',
          totalLessons,
          completedLessons,
          completed: courseCompleted,
        });
      }

      // 考试通过情况
      const examDetails = [];
      let examsPassed = 0;
      const subs = examSubsByPhone.get(phone) || [];
      for (const ei of examItems) {
        const examSubs = subs.filter((s) => s.exam_id === ei.itemId);
        const passed = examSubs.some((s) => s.passed);
        if (passed) examsPassed++;
        examDetails.push({
          itemId: ei.itemId,
          title: examTitleMap.get(ei.itemId) || '已删除考试',
          attempts: examSubs.length,
          passed,
        });
      }

      const onboardingCompleted =
        coursesCompleted === courseItems.length && examsPassed === examItems.length;

      result.set(phone, {
        coursesCompleted,
        coursesTotal: courseItems.length,
        examsPassed,
        examsTotal: examItems.length,
        onboardingCompleted,
        hasRequirements: true,
        totalWatchedDuration: durationByPhone.get(phone) || 0,
        examAttempts: attemptsByPhone.get(phone) || 0,
        courseDetails,
        examDetails,
      });
    }
    return result;
  }

  /**
   * 给入职项附带标题等信息
   */
  private async enrichOnboardingItems(items: OnboardingItem[]): Promise<any[]> {
    const courseIds = items.filter((i) => i.itemType === 'course').map((i) => i.itemId);
    const examIds = items.filter((i) => i.itemType === 'exam').map((i) => i.itemId);
    const titleMap = new Map<string, string>();

    if (this.useDb) {
      if (courseIds.length > 0) {
        const ph = courseIds.map(() => '?').join(',');
        const rows = await databaseService.query(`SELECT id, title FROM courses WHERE id IN (${ph})`, courseIds);
        for (const r of rows) titleMap.set('course|' + r.id, r.title);
      }
      if (examIds.length > 0) {
        const ph = examIds.map(() => '?').join(',');
        const rows = await databaseService.query(`SELECT id, title FROM exams WHERE id IN (${ph})`, examIds);
        for (const r of rows) titleMap.set('exam|' + r.id, r.title);
      }
    } else {
      // JSON 降级
      for (const c of readJson(COURSES_JSON)) {
        if (courseIds.includes(c.id)) titleMap.set('course|' + c.id, c.title);
      }
      for (const e of readJson(EXAMS_JSON)) {
        if (examIds.includes(e.id)) titleMap.set('exam|' + e.id, e.title);
      }
    }

    return items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemId: i.itemId,
      title: titleMap.get(i.itemType + '|' + i.itemId) || '已删除',
      sortOrder: i.sortOrder,
    }));
  }

  // ========== 树工具 ==========

  private buildTree(nodes: OrgNode[]): any[] {
    const map = new Map<string, any>();
    for (const n of nodes) {
      map.set(n.id, { ...n, nodeTypeLabel: nodeTypeLabel(n.nodeType), children: [] });
    }
    const roots: any[] = [];
    for (const n of nodes) {
      const node = map.get(n.id);
      if (n.parentId && map.has(n.parentId)) {
        map.get(n.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private attachStats(node: any, statsMap: Map<string, any>): any {
    const s = statsMap.get(node.id) || { userCount: 0, completedCount: 0, completionRate: 0, totalWatchedDuration: 0, totalExamAttempts: 0 };
    node.userCount = s.userCount;
    node.completedCount = s.completedCount;
    node.completionRate = s.completionRate;
    node.totalWatchedDuration = s.totalWatchedDuration;
    node.totalExamAttempts = s.totalExamAttempts;
    if (node.children && node.children.length > 0) {
      node.children = node.children.map((c: any) => this.attachStats(c, statsMap));
    }
    return node;
  }

  /**
   * 收集某节点及其所有子孙节点 id（用于按架构聚合）
   */
  private collectDescendantIds(nodes: any[], rootId: string): string[] {
    const result = [rootId];
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift();
      const children = nodes.filter((n) => n.parentId === cur);
      for (const c of children) {
        result.push(c.id);
        queue.push(c.id);
      }
    }
    return result;
  }

  // ========== 行映射 ==========

  private mapOrgRow(row: any): OrgNode {
    return {
      id: row.id,
      parentId: row.parent_id || null,
      nodeType: row.node_type || 'tenant',
      name: row.name || '',
      code: row.code || '',
      level: row.level || 0,
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
    };
  }

  private mapOrgJson(n: any): OrgNode {
    return {
      id: n.id,
      parentId: n.parentId || null,
      nodeType: n.nodeType || 'tenant',
      name: n.name || '',
      code: n.code || '',
      level: n.level || 0,
      sortOrder: n.sortOrder || 0,
      createdAt: n.createdAt,
    };
  }

  private toOrgJson(n: OrgNode): any {
    return {
      id: n.id, parentId: n.parentId, nodeType: n.nodeType, name: n.name,
      code: n.code, level: n.level, sortOrder: n.sortOrder, createdAt: n.createdAt,
    };
  }

  private mapUserRow(row: any): User {
    return {
      id: row.id,
      phone: row.phone,
      name: row.name || '',
      avatar: row.avatar || '',
      orgNodeId: row.org_node_id || null,
      position: row.position || '',
      role: row.role || 'employee',
      status: row.status || 'active',
      createdAt: row.created_at,
    };
  }

  private mapUserJson(u: any): User {
    return {
      id: u.id, phone: u.phone, name: u.name || '', avatar: u.avatar || '',
      orgNodeId: u.orgNodeId || null, position: u.position || '',
      role: u.role || 'employee', status: u.status || 'active', createdAt: u.createdAt,
    };
  }

  private toUserJson(u: User): any {
    return {
      id: u.id, phone: u.phone, name: u.name, avatar: u.avatar,
      orgNodeId: u.orgNodeId, position: u.position, role: u.role,
      status: u.status, createdAt: u.createdAt,
    };
  }

  private mapOnboardingRow(row: any): OnboardingItem {
    return {
      id: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
    };
  }

  private mapOnboardingJson(i: any): OnboardingItem {
    return {
      id: i.id, itemType: i.itemType, itemId: i.itemId,
      sortOrder: i.sortOrder || 0, createdAt: i.createdAt,
    };
  }

  private toOnboardingJson(i: OnboardingItem): any {
    return {
      id: i.id, itemType: i.itemType, itemId: i.itemId,
      sortOrder: i.sortOrder, createdAt: i.createdAt,
    };
  }
}
