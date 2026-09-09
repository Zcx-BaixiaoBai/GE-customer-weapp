const { Readable } = require('stream');

function decodeArrayBuffer(buf) {
  try {
    const bytes = new Uint8Array(buf);
    let result = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
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
        let code = ((b & 0x07) << 18) |
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
    console.error('解码失败:', e);
    return '';
  }
}

const FASTGPT_API_KEY = process.env.FASTGPT_API_KEY;
if (!FASTGPT_API_KEY) {
  console.error('请先设置环境变量 FASTGPT_API_KEY（密钥不入库）');
  process.exit(1);
}

fetch('http://localhost:3000/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + FASTGPT_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '你好' }],
    stream: true,
    detail: true,
  }),
}).then(async (res) => {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    console.log('---CHUNK---');
    console.log(text);
  }
}).catch(err => {
  console.error('请求失败:', err);
});
