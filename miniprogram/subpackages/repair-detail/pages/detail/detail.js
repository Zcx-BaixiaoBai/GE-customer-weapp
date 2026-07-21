Page({
  data: {
    repairId: '',
    detail: null
  },

  onLoad: function (options) {
    var id = (options && options.id) || '';
    this.setData({ repairId: id });
    var list = wx.getStorageSync('repair_list') || [];
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { found = list[i]; break; }
    }
    this.setData({ detail: found });
  }
});
