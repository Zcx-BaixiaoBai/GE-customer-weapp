var env = require('../config/env');
var requestUtil = require('./request');
var request = requestUtil.request;

function promisify(fn) {
  return function (opts) {
    return new Promise(function (resolve, reject) {
      fn(Object.assign({}, opts, { success: resolve, fail: reject }));
    });
  };
}

function login() {
  return promisify(wx.login)().then(function (loginRes) {
    var code = loginRes.code;
    if (!code) throw new Error('no code');
    return request({
      url: '/auth/wechat-login',
      method: 'POST',
      data: { code: code }
    });
  }).then(function (data) {
    wx.setStorageSync('access_token', data.accessToken);
    wx.setStorageSync('refresh_token', data.refreshToken);
    wx.setStorageSync('user_info', data.user);
    var app = getApp();
    if (app) {
      app.globalData.token = data.accessToken;
      app.globalData.userInfo = data.user;
    }
    return data.user;
  }).catch(function (err) {
    console.error('login error', err);
    throw err;
  });
}

// 微信授权手机号（新版API，直接用code换手机号）
// e 是 button open-type="getPhoneNumber" 的回调事件对象
function getPhoneFromWechat(e) {
  return new Promise(function (resolve, reject) {
    console.log('[auth] getPhoneFromWechat start, errMsg:', e.detail.errMsg);
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      reject(new Error('用户拒绝授权手机号'));
      return;
    }

    var code = e.detail.code;
    console.log('[auth] phone code:', code ? code.substring(0, 10) + '...' : 'EMPTY');
    if (!code) {
      reject(new Error('未获取到动态令牌'));
      return;
    }

    var apiUrl = env.config.API_BASE_URL + '/auth/phone';
    console.log('[auth] requesting:', apiUrl);

    wx.request({
      url: apiUrl,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code: code },
      timeout: 15000,
      success: function (r) {
        console.log('[auth] phone response:', r.statusCode, JSON.stringify(r.data).substring(0, 200));
        if (r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.phoneNumber) {
          wx.setStorageSync('user_phone', r.data.phoneNumber);
          wx.setStorageSync('user_pure_phone', r.data.purePhoneNumber);
          resolve(r.data.phoneNumber);
        } else {
          var msg = (r.data && r.data.message) || ('手机号获取失败(status:' + r.statusCode + ')');
          reject(new Error(msg));
        }
      },
      fail: function (err) {
        console.error('[auth] phone request FAILED:', err);
        var reason = '网络请求失败';
        if (err.errMsg && err.errMsg.indexOf('timeout') >= 0) reason = '请求超时，后端可能未启动';
        if (err.errMsg && err.errMsg.indexOf('fail') >= 0) reason = '无法连接服务器(' + env.config.API_BASE_URL + ')';
        reject(new Error(reason));
      }
    });
  });
}

function checkLogin() {
  return !!wx.getStorageSync('access_token');
}

function logout() {
  wx.removeStorageSync('access_token');
  wx.removeStorageSync('refresh_token');
  wx.removeStorageSync('user_info');
  wx.removeStorageSync('user_phone');
  wx.removeStorageSync('user_pure_phone');
  var app = getApp();
  if (app) {
    app.globalData.token = null;
    app.globalData.userInfo = null;
  }
}

module.exports = {
  login: login,
  checkLogin: checkLogin,
  logout: logout,
  promisify: promisify,
  getPhoneFromWechat: getPhoneFromWechat
};
