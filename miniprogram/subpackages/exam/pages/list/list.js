var config = require('../../../../config/env.js');

Page({
  data: {
    exams: [],
    loading: true
  },

  onLoad: function () {
    this.loadExams();
  },

  onPullDownRefresh: function () {
    this.loadExams();
  },

  loadExams: function () {
    var self = this;
    var url = config.config.API_BASE_URL + '/exam/list';
    console.log('[exam] requesting:', url);
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        console.log('[exam] response:', res.statusCode, res.data);
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var exams = res.data.data.filter(function (e) {
            return e.status === 'published';
          });
          self.setData({ exams: exams, loading: false });
        } else {
          self.setData({ loading: false });
          wx.showModal({
            title: '加载失败',
            content: 'HTTP ' + res.statusCode + ' | ' + JSON.stringify(res.data).substring(0, 200),
            showCancel: false
          });
        }
      },
      fail: function (err) {
        console.error('[exam] request failed:', err);
        self.setData({ loading: false });
        wx.showModal({
          title: '网络错误',
          content: 'URL: ' + url + '\n错误: ' + (err.errMsg || JSON.stringify(err)),
          showCancel: false
        });
      },
      complete: function () {
        wx.stopPullDownRefresh();
      }
    });
  },

  goExam: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/subpackages/exam/pages/take/take?id=' + id + '&title=' + e.currentTarget.dataset.title
    });
  },

  goResults: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/subpackages/exam/pages/result/result?phone=' + phone
    });
  }
});
