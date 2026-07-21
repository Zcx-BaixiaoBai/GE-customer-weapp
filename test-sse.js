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

const sseText = `data: {"id":"1","choices":[{"delta":{"role":"assistant"}}]}\n\ndata: {"id":"1","choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"id":"1","choices":[{"delta":{"content":"！"}}]}\n\ndata: {"id":"1","choices":[{"delta":{"content":"很高兴见到你！"}}]}\n\ndata: [DONE]\n\n`;

const encoder = new TextEncoder();
const buffer = encoder.encode(sseText);
const decoded = decodeArrayBuffer(buffer);
console.log('Decoded:', decoded);

let content = '';
const lines = decoded.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) continue;
  const dataStr = trimmed.slice(5).trim();
  if (dataStr === '[DONE]') {
    console.log('DONE');
    break;
  }
  try {
    const json = JSON.parse(dataStr);
    const delta = json.choices?.[0]?.delta;
    if (delta?.content) {
      content += delta.content;
      console.log('Chunk:', delta.content);
    }
  } catch (e) {
    console.error('Parse error:', dataStr);
  }
}
console.log('Final content:', content);
