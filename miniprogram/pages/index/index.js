Page({
  data: {
    greeting: '',
    dateStr: '',
    // 特色服务：双列等宽卡
    featured: [
      { id: 'chat', title: '智能问答', desc: '商场运营、物业规则，随问随答', path: '/pages/chat/chat', color: '#0071e3' },
      { id: 'repair', title: '智能报修', desc: '拍照说话，AI 自动填表', path: '/pages/repair/repair', color: '#ff9500' }
    ],
    // 更多服务：分组列表
    more: [
      { id: 'list', title: '我的报修', desc: '查看报修进度', path: '/subpackages/repair-detail/pages/list/list', color: '#34c759' },
      { id: 'training', title: '培训学习', desc: '课程视频、学习记录', path: '/subpackages/training/pages/list/list', color: '#ff3b30' },
      { id: 'exam', title: '在线考试', desc: '考试答题、成绩查询', path: '/subpackages/exam/pages/list/list', color: '#af52de' }
    ]
  },

  onLoad: function () {
    var now = new Date();
    var hour = now.getHours();
    var greeting = '晚上好';
    if (hour >= 5 && hour < 11) greeting = '早上好';
    else if (hour >= 11 && hour < 14) greeting = '中午好';
    else if (hour >= 14 && hour < 18) greeting = '下午好';
    var weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekDays[now.getDay()];
    this.setData({ greeting: greeting, dateStr: dateStr });
  },

  onFeatureTap: function (e) {
    var path = e.currentTarget.dataset.path;
    // Tab 页（首页/报修/个人中心）用 switchTab，其余 navigateTo
    var tabs = ['/pages/index/index', '/pages/repair/repair', '/pages/profile/profile'];
    if (tabs.indexOf(path) >= 0) {
      wx.switchTab({ url: path });
    } else {
      wx.navigateTo({ url: path });
    }
  },

  onShareAppMessage: function () {
    return {
      title: '金鹰世界物业 - 智能客服',
      path: '/pages/index/index'
    };
  }
});
