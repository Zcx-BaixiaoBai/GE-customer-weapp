var config = require('../../../../config/env.js');

Page({
  data: {
    certificates: [],
    loading: true
  },

  onLoad: function () {
    this.loadCertificates();
  },

  onPullDownRefresh: function () {
    this.loadCertificates();
  },

  loadCertificates: function () {
    var self = this;
    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) {
      self.setData({ loading: false });
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.stopPullDownRefresh();
      return;
    }

    wx.request({
      url: config.config.API_BASE_URL + '/exam/certificates?phone=' + phone,
      method: 'GET',
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          self.setData({
            certificates: res.data.data || [],
            loading: false
          });
        } else {
          self.setData({ loading: false });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: function () {
        wx.stopPullDownRefresh();
      }
    });
  },

  formatDate: function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '年' + (m < 10 ? '0' + m : m) + '月' + (day < 10 ? '0' + day : day) + '日';
  }
});
