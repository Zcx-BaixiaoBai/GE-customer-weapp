var config = require('../../config/env');

var TYPE_LABEL = { project: '项目', floor: '楼层', tenant: '租户' };

Page({
  data: {
    phone: '',
    mode: 'join',            // 'join' | 'create'
    tree: [],
    flatList: [],            // 展开后的可见节点列表
    newTenantName: '',
    submitting: false,
  },

  // 非响应式状态：展开映射 + 节点索引
  _expanded: {},
  _index: {},

  onLoad: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      var t = setTimeout(function () { wx.navigateBack(); }, 1000);
      return;
    }
    this.setData({ phone: phone });
    this.loadTree();
  },

  loadTree: function () {
    var self = this;
    var url = config.config.API_BASE_URL + '/org/tree';
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          var tree = res.data.data || [];
          self._expanded = {};
          self._index = {};
          self._buildIndex(tree);
          // 默认全部展开（有子节点即展开），便于直接看到租户
          (function walk(ns) {
            (ns || []).forEach(function (n) {
              if (n.children && n.children.length) {
                self._expanded[n.id] = true;
                walk(n.children);
              }
            });
          })(tree);
          self.setData({ tree: tree });
          self._rebuild();
        } else {
          self.setData({ flatList: [] });
        }
      },
      fail: function () {
        wx.showToast({ title: '加载架构失败', icon: 'none' });
      }
    });
  },

  _buildIndex: function (ns) {
    var self = this;
    (ns || []).forEach(function (n) {
      self._index[n.id] = n;
      if (n.children) self._buildIndex(n.children);
    });
  },

  // 由 tree + 展开状态生成可见的扁平列表（带 depth）
  _rebuild: function () {
    var self = this;
    var exp = self._expanded || {};
    var flat = [];
    (function walk(ns, depth) {
      (ns || []).forEach(function (n) {
        var hasCh = n.children && n.children.length;
        flat.push({
          id: n.id,
          name: n.name,
          code: n.code || '',
          nodeType: n.nodeType,
          typeLabel: TYPE_LABEL[n.nodeType] || n.nodeType,
          depth: depth,
          isTenant: n.nodeType === 'tenant',
          hasChildren: !!hasCh,
          expanded: !!exp[n.id]
        });
        if (hasCh && exp[n.id]) walk(n.children, depth + 1);
      });
    })(self.data.tree, 0);
    self.setData({ flatList: flat });
  },

  // 点击节点：租户→加入；项目/楼层→展开收起
  onNodeTap: function (e) {
    var id = e.currentTarget.dataset.id;
    var node = this._index[id];
    if (!node) return;
    if (node.nodeType === 'tenant') {
      this.joinTenant(id, node.name);
    } else {
      this._expanded[id] = !this._expanded[id];
      this._rebuild();
    }
  },

  switchMode: function (e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  onNameInput: function (e) {
    this.setData({ newTenantName: e.detail.value });
  },

  joinTenant: function (tenantId, tenantName) {
    var self = this;
    wx.showModal({
      title: '确认加入',
      content: '加入「' + tenantName + '」作为员工？',
      success: function (r) {
        if (r.confirm) self.doRegister({ mode: 'join', tenantId: tenantId });
      }
    });
  },

  createTenant: function () {
    var name = (this.data.newTenantName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入租户名称', icon: 'none' });
      return;
    }
    this.doRegister({ mode: 'create', tenantName: name });
  },

  doRegister: function (params) {
    var self = this;
    if (self.data.submitting) return;
    self.setData({ submitting: true });
    var url = config.config.API_BASE_URL + '/org/register';
    wx.request({
      url: url,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: Object.assign({ phone: self.data.phone }, params),
      timeout: 15000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          var user = res.data.data;
          wx.setStorageSync('user_role', user.role);
          wx.setStorageSync('user_org_node_id', user.orgNodeId);
          wx.showToast({
            title: user.role === 'manager' ? '已创建，您是店长' : '已加入',
            icon: 'success'
          });
          setTimeout(function () { wx.navigateBack(); }, 1200);
        } else {
          wx.showToast({ title: (res.data && res.data.message) || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: function () { self.setData({ submitting: false }); }
    });
  },
});
