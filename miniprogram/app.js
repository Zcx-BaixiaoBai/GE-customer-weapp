App({
  globalData: {
    userInfo: null,
    token: null,
    systemInfo: null
  },
  onLaunch: function () {
    try {
      this.globalData.systemInfo = wx.getSystemInfoSync();
    } catch (e) {
      console.error('systemInfo error', e);
    }
    var token = wx.getStorageSync('access_token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = wx.getStorageSync('user_info');
    }
  }
});
