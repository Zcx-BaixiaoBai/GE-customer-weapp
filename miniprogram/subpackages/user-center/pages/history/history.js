Page({
  data: {
    historyList: [],
  },

  onLoad() {
    // 占位：从本地读取历史记录
    const history = wx.getStorageSync('chat_history') || [];
    this.setData({ historyList: history });
  },
});
