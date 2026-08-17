var auth = require('../../utils/auth');
var config = require('../../config/env');

Page({
  data: {
    userInfo: null,
    phone: '',
    isLogin: false,
    nickName: '',
    avatarUrl: '',
    needSetupProfile: false,
    registered: false,
    isManager: false,
    tenantName: '',
    checkingTenant: false,
  },

  onLoad: function () {
    this.loadUserData();
  },

  onShow: function () {
    this.loadUserData();
  },

  loadUserData: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    var nickName = wx.getStorageSync('user_nickname') || '';
    var avatarUrl = wx.getStorageSync('user_avatar') || '';
    var isLogin = !!phone;
    var needSetup = isLogin && (!avatarUrl || !nickName);
    this.setData({
      phone: phone,
      isLogin: isLogin,
      nickName: nickName,
      avatarUrl: avatarUrl,
      needSetupProfile: needSetup
    });
    // 登录后检查租户注册状态
    if (isLogin) {
      this.checkRegistration(phone);
    } else {
      this.setData({ registered: false, isManager: false, tenantName: '' });
    }
  },

  // 检查当前用户是否已选择租户
  checkRegistration: function (phone) {
    var self = this;
    self.setData({ checkingTenant: true });
    var url = config.config.API_BASE_URL + '/org/my-profile?phone=' + encodeURIComponent(phone);
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          var d = res.data.data || {};
          self.setData({
            registered: !!d.registered,
            isManager: !!d.isManager,
            tenantName: (d.tenant && d.tenant.name) || '',
          });
        }
      },
      fail: function () { /* 静默失败，不影响使用 */ },
      complete: function () { self.setData({ checkingTenant: false }); }
    });
  },

  // 微信登录
  onGetPhone: function (e) {
    var self = this;
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '未授权手机号', icon: 'none' });
      return;
    }
    auth.getPhoneFromWechat(e).then(function (phone) {
      var nickName = wx.getStorageSync('user_nickname') || '';
      var avatarUrl = wx.getStorageSync('user_avatar') || '';
      var needSetup = !avatarUrl || !nickName;
      self.setData({
        phone: phone,
        isLogin: true,
        nickName: nickName,
        avatarUrl: avatarUrl,
        needSetupProfile: needSetup
      });
      // 登录成功后检查是否已选租户，未选则引导去选
      self.checkRegistrationAndGuide(phone);
    }).catch(function (err) {
      console.error('getPhone error', err);
      var msg = err && err.message ? err.message : '登录失败';
      wx.showModal({
        title: '登录失败',
        content: msg,
        showCancel: false
      });
    });
  },

  // 检查注册状态，未注册则引导选择租户
  checkRegistrationAndGuide: function (phone) {
    var self = this;
    var url = config.config.API_BASE_URL + '/org/my-profile?phone=' + encodeURIComponent(phone);
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          var d = res.data.data || {};
          self.setData({
            registered: !!d.registered,
            isManager: !!d.isManager,
            tenantName: (d.tenant && d.tenant.name) || '',
          });
          if (!d.registered) {
            wx.showModal({
              title: '选择租户',
              content: '请先选择您所在的租户（可加入已有租户或新建）',
              confirmText: '去选择',
              success: function (r) {
                if (r.confirm) {
                  wx.navigateTo({ url: '/pages/tenant-select/tenant-select' });
                }
              }
            });
          } else if (d.isManager) {
            wx.showToast({ title: '欢迎店长', icon: 'none' });
          }
        }
      },
      fail: function () { /* 静默 */ }
    });
  },

  // chooseAvatar回调 - 微信原生头像授权
  onChooseAvatar: function (e) {
    if (e.detail.avatarUrl) {
      this.setData({ avatarUrl: e.detail.avatarUrl });
      wx.setStorageSync('user_avatar', e.detail.avatarUrl);
    }
  },

  // 昵称输入
  onNickNameInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  onNickNameBlur: function (e) {
    var name = e.detail.value;
    if (name && name.trim()) {
      this.setData({ nickName: name });
      wx.setStorageSync('user_nickname', name);
    }
  },

  // 完成设置
  onSetupComplete: function () {
    if (!this.data.avatarUrl) {
      wx.showToast({ title: '请授权头像', icon: 'none' });
      return;
    }
    if (!this.data.nickName || !this.data.nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    wx.setStorageSync('user_nickname', this.data.nickName);
    this.setData({ needSetupProfile: false });
    wx.showToast({ title: '设置完成', icon: 'success' });
  },

  skipSetup: function () {
    this.setData({ needSetupProfile: false });
  },

  // 跳转选择租户
  goTenantSelect: function () {
    wx.navigateTo({ url: '/pages/tenant-select/tenant-select' });
  },

  // 店长管理
  goStoreManage: function () {
    wx.navigateTo({ url: '/subpackages/user-center/pages/store-manage/store-manage' });
  },

  goHistory: function () {
    wx.navigateTo({ url: '/subpackages/user-center/pages/history/history' });
  },

  goRepairList: function () {
    wx.navigateTo({ url: '/subpackages/repair-detail/pages/list/list' });
  },

  goCertificates: function () {
    wx.navigateTo({ url: '/subpackages/exam/pages/certificates/certificates' });
  },

  goPrivacy: function () {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onLogout: function () {
    var self = this;
    wx.showModal({
      title: '退出登录', content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {
          auth.logout();
          self.setData({
            phone: '', isLogin: false,
            nickName: '', avatarUrl: '', needSetupProfile: false,
            registered: false, isManager: false, tenantName: '',
          });
        }
      }
    });
  },
});
