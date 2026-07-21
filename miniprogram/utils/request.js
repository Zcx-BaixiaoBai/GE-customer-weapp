var env = require('../config/env');
var config = env.config;

function request(options) {
  return new Promise(function (resolve, reject) {
    var token = wx.getStorageSync('access_token');
    wx.request({
      url: config.API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 15000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : ''
      },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ code: res.statusCode, message: 'Request failed' });
        }
      },
      fail: function (err) {
        reject({ code: -1, message: 'Network error', detail: err });
      }
    });
  });
}

module.exports = { request: request };
