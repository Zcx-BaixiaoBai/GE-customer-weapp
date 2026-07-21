var env = require('../config/env');
var config = env.config;

// 获取报修类型列表
function getRepairTypes() {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: config.PMS_API + '/WY/GetWorkSheetType',
      method: 'POST',
      dataType: 'json',
      success: function (res) {
        if (res.data && res.data.data) {
          resolve(res.data.data);
        } else {
          resolve([]);
        }
      },
      fail: function (err) { reject(err); }
    });
  });
}

// 上传图片(base64方式，兼容工单系统)
function uploadPhoto(filePath) {
  return new Promise(function (resolve, reject) {
    // 读图片为base64
    var fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (res) {
        var base64Str = res.data;
        var fileName = newGuid() + '.jpg';
        wx.request({
          url: config.PMS_API + '/WY/UploadFile_APP',
          method: 'POST',
          dataType: 'json',
          header: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: {
            base64Str: base64Str,
            fileName: fileName,
            type: 0,
            creater_id: ''
          },
          success: function (res2) {
            if (res2.data && res2.data.code == '-1') {
              reject(new Error('上传失败'));
              return;
            }
            try {
              var dataObj = typeof res2.data.data === 'string' ? JSON.parse(res2.data.data) : res2.data.data;
              resolve(dataObj.accach_id);
            } catch (e) {
              reject(new Error('解析上传结果失败'));
            }
          },
          fail: function (err) { reject(err); }
        });
      },
      fail: function (err) { reject(err); }
    });
  });
}

// 提交工单
function submitWorkOrder(params) {
  return new Promise(function (resolve, reject) {
    var strJson = JSON.stringify({
      q_title: '',
      q_content: params.content,
      q_state: '0',
      wy_type: params.typeId,
      oper_name: '',
      oper_id: '',
      state: 0,
      creater_phone: params.phone,
      counter_id: parseInt(params.counterId),
      ACCACHID_Lst: params.accachIds
    });
    wx.request({
      url: config.PMS_API + '/WY/InsertWorkSheet',
      method: 'POST',
      dataType: 'json',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: { str_json: strJson },
      success: function (res) {
        resolve(res.data);
      },
      fail: function (err) { reject(err); }
    });
  });
}

function newGuid() {
  var guid = '';
  for (var i = 1; i <= 32; i++) {
    var n = Math.floor(Math.random() * 16.0).toString(16);
    guid += n;
    if (i == 8 || i == 12 || i == 16 || i == 20) guid += '-';
  }
  return guid;
}

module.exports = {
  getRepairTypes: getRepairTypes,
  uploadPhoto: uploadPhoto,
  submitWorkOrder: submitWorkOrder
};
