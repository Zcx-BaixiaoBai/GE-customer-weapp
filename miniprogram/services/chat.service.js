var env = require('../config/env');
var config = env.config;

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
    console.error('decode error', e);
    return '';
  }
}

function chatWithFastGPT(opts) {
  var onChunk = opts.onChunk || function () {};
  var onReasoning = opts.onReasoning || function () {};
  var onSources = opts.onSources || function () {};
  var onComplete = opts.onComplete || function () {};
  var onError = opts.onError || function () {};

  var requestData = {
    chatId: opts.chatId || undefined,
    stream: true,
    detail: true,
    messages: [{ role: 'user', content: opts.message }]
  };

  var task = wx.request({
    url: config.FASTGPT_BASE_URL + '/chat/completions',
    method: 'POST',
    enableChunked: true,
    header: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.FASTGPT_API_KEY
    },
    data: requestData,
    success: function (res) {
      if (res.statusCode !== 200) {
        onError({ message: 'FastGPT ' + res.statusCode });
        onComplete();
      }
    },
    fail: function (err) {
      onError(err);
      onComplete();
    }
  });

  if (task && task.onChunkReceived) {
    var buffer = '';
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
        var eventName = '';
        var dataStr = '';

        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].trim();
          if (!line) continue;
          if (line.indexOf('event:') === 0) {
            eventName = line.slice(6).trim();
          } else if (line.indexOf('data:') === 0) {
            dataStr = line.slice(5).trim();
          }
        }

        if (!dataStr) continue;
        if (dataStr === '[DONE]') {
          onComplete();
          return;
        }

        try {
          var json = JSON.parse(dataStr);
          if (eventName === 'flowNodeStatus') continue;

          var choices = json.choices;
          if (choices && choices.length > 0) {
            var delta = choices[0].delta;
            if (delta) {
              if (delta.content) onChunk(delta.content);
              if (delta.reasoning_content) onReasoning(delta.reasoning_content);
            }
            if (choices[0].quote) {
              onSources(choices[0].quote);
            }
          }
        } catch (e) {
          console.error('parse error', dataStr);
        }
      }
    });
  }

  return task;
}

module.exports = {
  chatWithFastGPT: chatWithFastGPT,
  decodeArrayBuffer: decodeArrayBuffer
};
