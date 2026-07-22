var env = require('../../../../config/env');
var config = env.config;

var PMS_API = 'https://pms-api.jinying.com/api';
var COUNTER_ID = config.PMS_COUNTER_ID || '23908';

// PMS工单状态映射
var STATE_MAP = {
  '0': '待处理',   // q_state=0 + state=0(正常)
  '1': '已关闭',   // state=1
  '2': '已退回',   // state=2
  '3': '已暂停',   // state=3
  '4': '已派单',
  '5': '处理中',
  '6': '已完成',
  '9': '已完成'
};

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
  return timeStr.substring(0, 4) + '-' + timeStr.substring(4, 6) + '-' + timeStr.substring(6, 8) +
    ' ' + (timeStr.length >= 14 ? timeStr.substring(8, 10) + ':' + timeStr.substring(10, 12) : '');
}

Page({
  data: {
    repairList: [],
    loading: true,
    phone: ''
  },

  onLoad: function () {
    var phone = wx.getStorageSync('user_phone') || '';
    this.setData({ phone: phone });
    this.loadFromPMS(phone);
  },

  onShow: function () {
    if (this.data.phone) {
      this.loadFromPMS(this.data.phone);
    }
  },

  onPullDownRefresh: function () {
    if (this.data.phone) {
      this.loadFromPMS(this.data.phone);
    }
    wx.stopPullDownRefresh();
  },

  loadFromPMS: function (phone) {
    var self = this;
    if (!phone) {
      this.setData({ repairList: [], loading: false });
      return;
    }

    this.setData({ loading: true });

    var param = "{type:'1',roletype:'0',employee_id:'',id:'" + COUNTER_ID + "'}";
    wx.request({
      url: PMS_API + '/WY/GetWorkSheetList',
      method: 'POST',
      dataType: 'json',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: { str_json: param, page: 1, limit: 50 },
      success: function (res) {
        if (res.data && res.data.code == '0' && res.data.data) {
          // 按手机号过滤——只显示当前用户的工单
          var filtered = [];
          for (var i = 0; i < res.data.data.length; i++) {
            var item = res.data.data[i];
            if (item.creater_phone === phone) {
              filtered.push({
                id: item.q_id,
                q_id: item.q_id,
                type: item.wy_type_name || '其他',
                content: item.q_content || '',
                status: getStateText(item.q_state, item.state),
                state: item.state,
                q_state: item.q_state,
                phone: item.creater_phone,
                createTime: formatTime(item.create_time),
                rawTime: item.create_time,
                counter: item.counter || '',
                brand: item.brand || '',
                prj: item.prj || ''
              });
            }
          }
          self.setData({ repairList: filtered, loading: false });
        } else {
          self.setData({ repairList: [], loading: false });
        }
      },
      fail: function (err) {
        console.error('[list] PMS request fail:', err);
        // PMS不可用时降级到本地缓存
        var local = wx.getStorageSync('repair_list') || [];
        var filtered = [];
        for (var i = 0; i < local.length; i++) {
          if (local[i].phone === phone) filtered.push(local[i]);
        }
        self.setData({ repairList: filtered, loading: false });
        wx.showToast({ title: '网络异常，显示本地记录', icon: 'none' });
      }
    });
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    var qid = e.currentTarget.dataset.qid;
    wx.navigateTo({
      url: '/subpackages/repair-detail/pages/detail/detail?id=' + id + '&qid=' + qid
    });
  }
});
