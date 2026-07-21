Page({
  data: {
    repairList: []
  },

  onLoad: function () {
    var list = wx.getStorageSync('repair_list') || [];
    this.setData({ repairList: list });
  },

  onShow: function () {
    var list = wx.getStorageSync('repair_list') || [];
    this.setData({ repairList: list });
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/subpackages/repair-detail/pages/detail/detail?id=' + id });
  }
});
