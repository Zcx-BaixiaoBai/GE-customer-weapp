var env = require('../../../../config/env');
var config = env.config;

var PMS_API = 'https://pms-api.jinying.com/api';
var COUNTER_ID = config.PMS_COUNTER_ID || '23908';

function getStateText(qState, state) {
  if (state == 1) return '已关闭';
  if (state == 2) return '已退回';
  if (state == 3) return '已暂停';
  if (qState == 0) return '待处理';
  if (qState == 1) return '已派单';
  if (qState == 2) return '处理中';
  if (qState == 3 || qState == 9) return '已完成';
  return '处理中';
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.length < 8) return '';
  var s = timeStr.substring(0, 4) + '-' + timeStr.substring(4, 6) + '-' + timeStr.substring(6, 8);
  if (timeStr.length >= 14) {
    s += ' ' + timeStr.substring(8, 10) + ':' + timeStr.substring(10, 12);
  }
  return s;
}

Page({
  data: {
    detail: null,
    loading: true,
    photos: []
  },

  onLoad: function (options) {
    var qid = options.qid || options.id;
    if (qid) {
      this.loadFromPMS(qid);
    } else {
      this.setData({ loading: false });
    }
  },

  loadFromPMS: function (qid) {
    var self = this;
    this.setData({ loading: true });

    wx.request({
      url: PMS_API + '/WY/GetWorkSheetInfo',
      method: 'POST',
      dataType: 'json',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: { q_id: qid },
      success: function (res) {
        if (res.data && res.data.code == '0' && res.data.basic) {
          var b = res.data.basic;
          var photos = [];
          if (res.data.file_list) {
            for (var i = 0; i < res.data.file_list.length; i++) {
              if (res.data.file_list[i].accach_path) {
                // PMS返回的URL含Windows反斜杠，替换成正斜杠
                var imgPath = res.data.file_list[i].accach_path.replace(/\\/g, '/');
                photos.push(imgPath);
              }
            }
          }
          self.setData({
            detail: {
              q_id: b.q_id,
              type: b.wy_type_name || '其他',
              content: b.q_content || '',
              status: getStateText(b.q_state, b.state),
              phone: b.creater_phone || '',
              createTime: formatTime(b.create_time),
              workerName: b.worker_name || '',
              counter: b.counter || '',
              brand: b.brand || '',
              prj: b.prj || ''
            },
            photos: photos,
            loading: false
          });
        } else {
          self.setData({ detail: null, loading: false });
        }
      },
      fail: function (err) {
        console.error('[detail] PMS request fail:', err);
        // 降级到本地
        var local = wx.getStorageSync('repair_list') || [];
        var found = null;
        for (var i = 0; i < local.length; i++) {
          if (String(local[i].id) === String(qid) || String(local[i].q_id) === String(qid)) {
            found = local[i];
            break;
          }
        }
        self.setData({ detail: found, loading: false });
      }
    });
  },

  previewPhoto: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        current: url,
        urls: this.data.photos
      });
    }
  }
});
