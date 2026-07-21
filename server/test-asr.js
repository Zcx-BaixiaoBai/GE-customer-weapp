// 测试腾讯云一句话识别 - 直接用crypto签名+axios调用
require('dotenv').config();
var crypto = require('crypto');
var https = require('https');

var SECRET_ID = process.env.TENCENT_CLOUD_SECRET_ID;
var SECRET_KEY = process.env.TENCENT_CLOUD_SECRET_KEY;

console.log('SecretId:', SECRET_ID ? SECRET_ID.substring(0, 12) + '...' : 'EMPTY');
console.log('SecretKey:', SECRET_KEY ? SECRET_KEY.substring(0, 4) + '...' : 'EMPTY');

if (!SECRET_ID || !SECRET_KEY) {
  console.error('ERROR: 密钥未配置');
  process.exit(1);
}

// 生成一段测试音频的base64（1秒静音wav）
function makeTestWav() {
  var sampleRate = 16000;
  var duration = 0.5;
  var numSamples = Math.floor(sampleRate * duration);
  var dataSize = numSamples * 2;
  var buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // 静音数据全0
  return buf.toString('base64');
}

var payload = JSON.stringify({
  EngSerViceType: '16k_zh',
  SourceType: 1,
  VoiceFormat: 'wav',
  Data: makeTestWav(),
  FilterDirty: 0,
  FilterModal: 0,
  FilterPunc: 0,
  ConvertNumMode: 1
});

var service = 'asr';
var timestamp = Math.floor(Date.now() / 1000);
var date = new Date(timestamp * 1000).toISOString().slice(0, 10);
var credentialScope = date + '/' + service + '/tc3_request';

// 步骤1：规范请求串
var httpRequestMethod = 'POST';
var canonicalUri = '/';
var canonicalQueryString = '';
var canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:asr.tencentcloudapi.com\n';
var signedHeaders = 'content-type;host';
var hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
var canonicalRequest = httpRequestMethod + '\n' +
  canonicalUri + '\n' +
  canonicalQueryString + '\n' +
  canonicalHeaders + '\n' +
  signedHeaders + '\n' +
  hashedRequestPayload;

// 步骤2：签名串
var algorithm = 'TC3-HMAC-SHA256';
var hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
var stringToSign = algorithm + '\n' +
  timestamp + '\n' +
  credentialScope + '\n' +
  hashedCanonicalRequest;

// 步骤3：计算签名
var secretDate = crypto.createHmac('sha256', 'TC3' + SECRET_KEY).update(date).digest();
var secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
var secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
var signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

// 步骤4：组装Authorization
var authorization = algorithm + ' ' +
  'Credential=' + SECRET_ID + '/' + credentialScope + ', ' +
  'SignedHeaders=' + signedHeaders + ', ' +
  'Signature=' + signature;

var headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Host': 'asr.tencentcloudapi.com',
  'X-TC-Action': 'SentenceRecognition',
  'X-TC-Version': '2019-06-14',
  'X-TC-Timestamp': timestamp.toString(),
  'X-TC-Region': 'ap-shanghai',
  'Authorization': authorization
};

var options = {
  hostname: 'asr.tencentcloudapi.com',
  port: 443,
  path: '/',
  method: 'POST',
  headers: headers
};

console.log('Sending ASR request...');
var req = https.request(options, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    console.log('Status:', res.statusCode);
    var result = JSON.parse(data);
    if (result.Response) {
      console.log('Result:', result.Response.Result || '(empty)');
      console.log('AudioDuration:', result.Response.AudioDuration || 0, 'ms');
      console.log('RequestId:', result.Response.RequestId);
      if (result.Response.Error) {
        console.log('Error:', result.Response.Error.Code, result.Response.Error.Message);
      }
    }
    console.log('\nASR连通成功!');
  });
});

req.on('error', function(e) {
  console.error('Request error:', e.message);
});

req.write(payload);
req.end();
