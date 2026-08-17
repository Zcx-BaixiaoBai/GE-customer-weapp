var config = require('../../../../config/env');

Page({
  data: {
    phone: '',
    loading: true,
    error: '',
    node: null,
    summary: {},
    users: [],
    onboardingItems: [],
    manager: {},
  },

  onLoad: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    this.setData({ phone: phone });
    this.loadData();
  },

  onPullDownRefresh: function () {
    this.loadData();
  },

  loadData: function () {
    var self = this;
    self.setData({ loading: true, error: '' });
    var url = config.config.API_BASE_URL + '/org/my-store?phone=' + encodeURIComponent(self.data.phone);
    wx.request({
      url: url,
      method: 'GET',
      timeout: 15000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          var d = res.data.data || {};
          // 转换学习时长为分钟
          var users = (d.users || []).map(function (u) {
            u.durationMin = Math.round((u.totalWatchedDuration || 0) / 60);
            return u;
          });
          self.setData({
            node: d.node,
            summary: d.summary || {},
            users: users,
            onboardingItems: d.onboardingItems || [],
            manager: d.manager || {},
            loading: false,
          });
        } else {
          self.setData({ loading: false, error: (res.data && res.data.message) || '加载失败' });
        }
      },
      fail: function () {
        self.setData({ loading: false, error: '网络错误' });
      },
      complete: function () {
        wx.stopPullDownRefresh();
      }
    });
  },

  goOnboarding: function () {
    wx.navigateTo({ url: '/subpackages/exam/pages/list/list' });
  },
});
