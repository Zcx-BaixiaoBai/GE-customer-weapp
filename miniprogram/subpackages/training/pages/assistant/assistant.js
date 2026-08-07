var config = require('../../../../config/env.js');

// SSE 解码函数（复用 chat.service.js 的逻辑）
function decodeArrayBuffer(buf) {
  try {
    var bytes = new Uint8Array(buf);
    var result = '';
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      if (b < 0x80) {
        result += String.fromCharCode(b);
        i++;
      } else if (b < 0xE0) {
        result += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
        i += 2;
      } else if (b < 0xF0) {
        result += String.fromCharCode(
          ((b & 0x0F) << 12) |
          ((bytes[i + 1] & 0x3F) << 6) |
          (bytes[i + 2] & 0x3F)
        );
        i += 3;
      } else {
        var code = ((b & 0x07) << 18) |
          ((bytes[i + 1] & 0x3F) << 12) |
          ((bytes[i + 2] & 0x3F) << 6) |
          (bytes[i + 3] & 0x3F);
        code -= 0x10000;
        result += String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
        i += 4;
      }
    }
    return result;
  } catch (e) {
    return '';
  }
}

Page({
  data: {
    messages: [],
    inputValue: '',
    isStreaming: false,
    courseId: '',
    courseTitle: '',
    courseDescription: '',
    lessonContent: '',
    scrollToView: ''
  },

  onLoad: function (options) {
    this.setData({
      courseId: options.courseId || '',
      courseTitle: decodeURIComponent(options.title || ''),
      courseDescription: decodeURIComponent(options.desc || ''),
      lessonContent: decodeURIComponent(options.lesson || '')
    });

    this.setData({
      messages: [{
        role: 'assistant',
        content: '您好！我是本课程的AI培训助手，有任何疑问可以随时问我。',
        time: Date.now()
      }]
    });
  },

  onInput: function (e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSend: function () {
    var self = this;
    var inputValue = this.data.inputValue;
    if (!inputValue.trim() || this.data.isStreaming) return;

    var userMsg = {
      role: 'user',
      content: inputValue.trim(),
      time: Date.now()
    };
    var assistantMsg = {
      role: 'assistant',
      content: '',
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
    var contentBuffer = '';
    var buffer = '';

    var task = wx.request({
      url: config.config.API_BASE_URL + '/training/assistant',
      method: 'POST',
      enableChunked: true,
      header: { 'Content-Type': 'application/json' },
      data: {
        message: inputValue.trim(),
        courseTitle: self.data.courseTitle,
        courseDescription: self.data.courseDescription,
        lessonContent: self.data.lessonContent
      },
      success: function (res) {
        if (res.statusCode !== 200) {
          var obj = {};
          obj['messages[' + lastIdx() + '].content'] = 'AI服务异常(HTTP ' + res.statusCode + ')';
          obj['messages[' + lastIdx() + '].streaming'] = false;
          self.setData(obj);
        }
      },
      fail: function (err) {
        var obj = {};
        obj['messages[' + lastIdx() + '].content'] = '网络错误: ' + (err.errMsg || '');
        obj['messages[' + lastIdx() + '].streaming'] = false;
        self.setData(obj);
        self.setData({ isStreaming: false });
      },
      complete: function () {
        var obj = {};
        obj['messages[' + lastIdx() + '].streaming'] = false;
        self.setData(obj);
        self.setData({ isStreaming: false });
      }
    });

    if (task && task.onChunkReceived) {
      task.onChunkReceived(function (res) {
        var textData = '';
        if (typeof res.data === 'string') {
          textData = res.data;
        } else if (res.data && res.data.byteLength) {
          textData = decodeArrayBuffer(res.data);
        }
        if (!textData) return;

        buffer += textData;

        while (true) {
          var sepIndex = buffer.indexOf('\n\n');
          if (sepIndex === -1) break;

          var msg = buffer.slice(0, sepIndex).trim();
          buffer = buffer.slice(sepIndex + 2);
          if (!msg) continue;

          var lines = msg.split('\n');
          var dataStr = '';
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (line.indexOf('data:') === 0) {
              dataStr = line.slice(5).trim();
            }
          }
          if (!dataStr) continue;
          if (dataStr === '[DONE]') {
            var doneObj = {};
            doneObj['messages[' + lastIdx() + '].streaming'] = false;
            self.setData(doneObj);
            self.setData({ isStreaming: false });
            return;
          }

          try {
            var json = JSON.parse(dataStr);
            var choices = json.choices;
            if (choices && choices.length > 0) {
              var delta = choices[0].delta;
              if (delta && delta.content) {
                contentBuffer += delta.content;
                var obj = {};
                obj['messages[' + lastIdx() + '].content'] = contentBuffer;
                self.setData(obj);
                self.scrollToBottom();
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      });
    }
  },

  scrollToBottom: function () {
    var self = this;
    setTimeout(function () {
      self.setData({ scrollToView: 'msg-' + (self.data.messages.length - 1) });
    }, 50);
  }
});
