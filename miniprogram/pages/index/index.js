Page({
  data: {
    features: [
      { id: 'chat', title: '智能问答', desc: '商场运营、物业规则、入驻指南', path: '/pages/chat/chat', color: '#3370ff', iconText: '问' },
      { id: 'repair', title: '智能报修', desc: '拍照说话，AI自动填表', path: '/pages/repair/repair', color: '#00b578', iconText: '修' },
      { id: 'list', title: '我的报修', desc: '查看报修进度', path: '/subpackages/repair-detail/pages/list/list', color: '#ff8f1f', iconText: '单' },
      { id: 'profile', title: '个人中心', desc: '账号、历史记录', path: '/subpackages/user-center/pages/profile/profile', color: '#7b61ff', iconText: '我' }
    ]
  },

  onFeatureTap: function (e) {
    var path = e.currentTarget.dataset.path;
    if (path.indexOf('subpackages') >= 0) {
      wx.navigateTo({ url: path });
    } else {
      wx.switchTab({ url: path });
    }
  },

  onShareAppMessage: function () {
    return {
      title: '金鹰世界物业 - 智能客服',
      path: '/pages/index/index'
    };
  }
});
