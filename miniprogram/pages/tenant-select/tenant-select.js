var config = require('../../config/env');

Page({
  data: {
    phone: '',
    mode: 'join',        // 'join' | 'create'
    tenants: [],
    loading: true,
    newTenantName: '',
    submitting: false,
  },

  onLoad: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      var t = setTimeout(function () { wx.navigateBack(); }, 1000);
      return;
    }
    this.setData({ phone: phone });
    this.loadTenants();
  },

  loadTenants: function () {
    var self = this;
    var url = config.config.API_BASE_URL + '/org/tenants';
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          self.setData({ tenants: res.data.data || [], loading: false });
        } else {
          self.setData({ loading: false });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载租户列表失败', icon: 'none' });
      }
    });
  },

  switchMode: function (e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  onNameInput: function (e) {
    this.setData({ newTenantName: e.detail.value });
  },

  joinTenant: function (e) {
    var tenantId = e.currentTarget.dataset.id;
    var tenantName = e.currentTarget.dataset.name;
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
