var config = require('../../../../config/env.js');

Page({
  data: {
    phone: '',
    submissionId: '',
    percentage: 0,
    passed: false,
    recentSubmissions: [],
    stats: null,
    loading: true
  },

  onLoad: function (options) {
    var self = this;

    if (options.submissionId) {
      // 刚考完跳过来，直接显示结果
      this.setData({
        submissionId: options.submissionId,
        percentage: parseInt(options.percentage) || 0,
        passed: options.passed === 'true',
        loading: false
      });
      this.loadStats();
    } else if (options.phone) {
      // 从考试记录入口进来的
      this.setData({ phone: options.phone });
      this.loadStats();
    }
  },

  loadStats: function () {
    var phone = this.data.phone || wx.getStorageSync('user_phone') || '';
    if (!phone) {
      this.setData({ loading: false });
      return;
    }

    var self = this;
    wx.request({
      url: config.config.API_BASE_URL + '/exam/stats?phone=' + phone,
      method: 'GET',
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          self.setData({
            stats: res.data.data,
            recentSubmissions: res.data.data.recentSubmissions || [],
            loading: false
          });
        } else {
          self.setData({ loading: false });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      }
    });
  },

  goBack: function () {
    wx.navigateBack();
  },

  retakeExam: function () {
    wx.navigateBack();
  },

  goCertificates: function () {
    wx.navigateTo({
      url: '/subpackages/exam/pages/certificates/certificates'
    });
  }
});
