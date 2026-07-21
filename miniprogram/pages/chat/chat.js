var chatService = require('../../services/chat.service');
var env = require('../../config/env');
var config = env.config;

Page({
  data: {
    messages: [],
    inputValue: '',
    isStreaming: false,
    chatId: '',
    scrollToView: '',
    showSources: -1,
    showReasoning: -1,
    isConfigured: false
  },

  onLoad: function () {
    var configured = !!(config.FASTGPT_API_KEY && config.FASTGPT_BASE_URL);
    this.setData({ isConfigured: configured });
    if (configured) {
      this.initChat();
    } else {
      this.setData({
        messages: [{
          role: 'system',
          content: 'FastGPT尚未配置，请在config/env.js中填入API Key。'
        }]
      });
    }
  },

  initChat: function () {
    this.setData({
      chatId: 'mp_' + Date.now(),
      messages: [{
        role: 'assistant',
        content: '您好！我是金鹰世界智能客服，有什么可以帮您的？',
        streaming: false,
        reasoning: '',
        time: Date.now(),
        sources: []
      }]
    });
  },

  onInput: function (e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSend: function () {
    var self = this;
    var inputValue = this.data.inputValue;
    if (!inputValue.trim() || this.data.isStreaming || !this.data.isConfigured) return;

    var userMsg = {
      role: 'user',
      content: inputValue.trim(),
      time: Date.now()
    };
    var assistantMsg = {
      role: 'assistant',
      content: '',
      reasoning: '',
      sources: [],
      streaming: true,
      time: Date.now()
    };

    this.setData({
      messages: this.data.messages.concat([userMsg, assistantMsg]),
      inputValue: '',
      isStreaming: true
    });
    this.scrollToBottom();

    var lastIdx = function () { return self.data.messages.length - 1; };
    var reasoningBuffer = '';
    var reasoningTimer = null;
    var contentBuffer = '';
    var contentTimer = null;

    var flushReasoning = function () {
      if (reasoningBuffer) {
        var obj = {};
        obj['messages[' + lastIdx() + '].reasoning'] = reasoningBuffer;
        self.setData(obj);
      }
    };

    var flushContent = function () {
      if (contentBuffer) {
        var obj = {};
        obj['messages[' + lastIdx() + '].content'] = contentBuffer;
        self.setData(obj);
        self.scrollToBottom();
      }
    };

    chatService.chatWithFastGPT({
      message: inputValue.trim(),
      chatId: this.data.chatId,
      onChunk: function (chunk) {
        contentBuffer += chunk;
        if (!contentTimer) {
          contentTimer = setTimeout(function () {
            contentTimer = null;
            flushContent();
          }, 80);
        }
      },
      onReasoning: function (text) {
        if (!text) return;
        reasoningBuffer += text;
        if (!reasoningTimer) {
          reasoningTimer = setTimeout(function () {
            reasoningTimer = null;
            flushReasoning();
          }, 200);
        }
      },
      onSources: function (sources) {
        var obj = {};
        obj['messages[' + lastIdx() + '].sources'] = sources;
        self.setData(obj);
      },
      onComplete: function () {
        if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
        if (reasoningTimer) { clearTimeout(reasoningTimer); reasoningTimer = null; }
        flushContent();
        flushReasoning();
        var obj = {};
        obj['messages[' + lastIdx() + '].streaming'] = false;
        obj.isStreaming = false;
        self.setData(obj);
      },
      onError: function (err) {
        console.error('error', err);
        if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
        if (reasoningTimer) { clearTimeout(reasoningTimer); reasoningTimer = null; }
        var obj = {};
        obj['messages[' + lastIdx() + '].content'] = '抱歉，回答出现问题，请稍后重试。';
        obj['messages[' + lastIdx() + '].streaming'] = false;
        obj.isStreaming = false;
        self.setData(obj);
      }
    });
  },

  toggleSources: function (e) {
    var idx = e.currentTarget.dataset.idx;
    this.setData({ showSources: this.data.showSources === idx ? -1 : idx });
  },

  toggleReasoning: function (e) {
    var idx = e.currentTarget.dataset.idx;
    this.setData({ showReasoning: this.data.showReasoning === idx ? -1 : idx });
  },

  scrollToBottom: function () {
    var self = this;
    wx.nextTick(function () {
      self.setData({ scrollToView: 'msg-bottom' });
    });
  },

  newChat: function () {
    if (this.data.isStreaming) {
      wx.showToast({ title: '请等待回答完成', icon: 'none' });
      return;
    }
    this.initChat();
  },

  onShareAppMessage: function () {
    return {
      title: '金鹰世界智能客服',
      path: '/pages/chat/chat'
    };
  }
});
