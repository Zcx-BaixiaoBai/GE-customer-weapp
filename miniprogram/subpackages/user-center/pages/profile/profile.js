var auth = require('../../../../utils/auth');

Page({
  data: {
    userInfo: null,
    phone: '',
    isLogin: false,
    nickName: '',
    avatarUrl: '',
    needSetupProfile: false,
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

  goHistory: function () {
    wx.navigateTo({ url: '/subpackages/user-center/pages/history/history' });
  },

  goRepairList: function () {
    wx.navigateTo({ url: '/subpackages/repair-detail/pages/list/list' });
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
            nickName: '', avatarUrl: '', needSetupProfile: false
          });
        }
      }
    });
  },
});
