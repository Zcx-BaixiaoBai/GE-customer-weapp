import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { OrgService } from './org.service';

/**
 * 组织架构 / 租户管理 / 入职统计
 * 路由前缀: /api/org
 */
@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  // ========== 组织架构 ==========

  @Get('tree')
  async getTree() {
    return { code: 0, data: await this.orgService.getTree() };
  }

  @Get('nodes')
  async getAllNodes() {
    return { code: 0, data: await this.orgService.getAllNodes() };
  }

  @Get('nodes/:id')
  async getNode(@Param('id') id: string) {
    const node = await this.orgService.getNodeById(id);
    return node ? { code: 0, data: node } : { code: -1, message: '节点不存在' };
  }

  @Post('nodes')
  async createNode(@Body() body: any) {
    try {
      const node = await this.orgService.createNode(body);
      return { code: 0, data: node };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  @Put('nodes/:id')
  async updateNode(@Param('id') id: string, @Body() body: any) {
    const node = await this.orgService.updateNode(id, body);
    return node ? { code: 0, data: node } : { code: -1, message: '节点不存在' };
  }

  @Delete('nodes/:id')
  async deleteNode(@Param('id') id: string) {
    const ok = await this.orgService.deleteNode(id);
    return { code: ok ? 0 : -1 };
  }

  // ========== 用户（租户员工） ==========

  @Get('users')
  async getUsers(@Query('org_node_id') orgNodeId?: string) {
    const users = orgNodeId
      ? await this.orgService.getUsersUnderNode(orgNodeId)
      : await this.orgService.getUsers();
    return { code: 0, data: users };
  }

  @Get('users/phone/:phone')
  async getUserByPhone(@Param('phone') phone: string) {
    const user = await this.orgService.getUserByPhone(phone);
    return user ? { code: 0, data: user } : { code: -1, message: '用户不存在' };
  }

  @Post('users')
  async createUser(@Body() body: any) {
    try {
      const user = await this.orgService.createUser(body);
      return { code: 0, data: user };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    const user = await this.orgService.updateUser(id, body);
    return user ? { code: 0, data: user } : { code: -1, message: '用户不存在' };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    const ok = await this.orgService.deleteUser(id);
    return { code: ok ? 0 : -1 };
  }

  // ========== 小程序端：租户选择 / 店长视图 ==========

  /** 列出所有租户（小程序「选择租户」页） */
  @Get('tenants')
  async getTenants() {
    return { code: 0, data: await this.orgService.getTenants() };
  }

  /** 小程序注册：登录后绑定到租户（join 已有 / create 新建） */
  @Post('register')
  async register(@Body() body: any) {
    try {
      const user = await this.orgService.registerUser({
        phone: body.phone,
        name: body.name,
        mode: body.mode,
        tenantId: body.tenantId,
        tenantName: body.tenantName,
        parentNodeId: body.parentNodeId,
        position: body.position,
      });
      return { code: 0, data: user };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  /** 当前用户档案（含租户/角色，用于判断是否已选租户） */
  @Get('my-profile')
  async getMyProfile(@Query('phone') phone: string) {
    if (!phone) return { code: -1, message: '缺少 phone 参数' };
    return { code: 0, data: await this.orgService.getMyProfile(phone) };
  }

  /** 店长视图：本店所有员工的学习/入职情况 */
  @Get('my-store')
  async getMyStore(@Query('phone') phone: string) {
    if (!phone) return { code: -1, message: '缺少 phone 参数' };
    try {
      return { code: 0, data: await this.orgService.getMyStore(phone) };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  // ========== 入职必修项 ==========

  @Get('onboarding')
  async getOnboardingItems() {
    return { code: 0, data: await this.orgService.getOnboardingItems() };
  }

  @Post('onboarding')
  async addOnboardingItem(@Body() body: any) {
    try {
      const item = await this.orgService.addOnboardingItem(body.itemType, body.itemId);
      return { code: 0, data: item };
    } catch (e) {
      return { code: -1, message: e.message };
    }
  }

  @Delete('onboarding/:id')
  async removeOnboardingItem(@Param('id') id: string) {
    const ok = await this.orgService.removeOnboardingItem(id);
    return { code: ok ? 0 : -1 };
  }

  // ========== 按架构统计 ==========

  /**
   * 入职完成统计 —— 整棵架构树，每节点带完成率
   */
  @Get('stats/onboarding')
  async getOnboardingTreeStats() {
    return { code: 0, data: await this.orgService.getOnboardingTreeStats() };
  }

  /**
   * 某架构节点的入职明细 —— 节点下每个用户的完成情况
   */
  @Get('stats/onboarding/:nodeId')
  async getOnboardingNodeDetail(@Param('nodeId') nodeId: string) {
    return { code: 0, data: await this.orgService.getOnboardingNodeDetail(nodeId) };
  }
}
