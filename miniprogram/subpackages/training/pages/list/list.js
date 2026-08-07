var config = require('../../../../config/env.js');

Page({
  data: {
    courses: [],
    loading: true
  },

  onLoad: function () {
    this.loadCourses();
  },

  onPullDownRefresh: function () {
    this.loadCourses();
  },

  loadCourses: function () {
    var self = this;
    var url = config.config.API_BASE_URL + '/training/courses';
    console.log('[training] requesting:', url);
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        console.log('[training] response:', res.statusCode, res.data);
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var courses = res.data.data.map(function (c) {
            var totalLessons = c.lessons ? c.lessons.length : 0;
            var totalDuration = 0;
            if (c.lessons) {
              for (var i = 0; i < c.lessons.length; i++) {
                totalDuration += c.lessons[i].duration || 0;
              }
            }
            return {
              id: c.id,
              title: c.title,
              description: c.description,
              coverImage: c.coverImage || '',
              category: c.category,
              lessonCount: totalLessons,
              totalDurationText: self.formatDuration(totalDuration)
            };
          });
          self.setData({ courses: courses, loading: false });
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
        console.error('[training] request failed:', err);
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

  formatDuration: function (seconds) {
    if (!seconds || seconds === 0) return '';
    var min = Math.floor(seconds / 60);
    if (min < 60) return min + '分钟';
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h + '小时' + (m > 0 ? m + '分' : '');
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/subpackages/training/pages/detail/detail?id=' + id
    });
  }
});
