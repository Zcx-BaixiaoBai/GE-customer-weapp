var env = require('../../config/env');
var config = env.config;
var auth = require('../../utils/auth');

var PMS_API = 'https://pms-api.jinying.com/api';
var COUNTER_ID = config.PMS_COUNTER_ID || '23908';

Page({
  data: {
    phase: 'camera',       // camera -> reviewing -> recording -> analyzing -> supplement -> preview -> success
    photos: [],
    isRecording: false,
    recordingDuration: 0,
    audioPath: '',
    analyzing: false,
    analyzeStep: '',
    transcribedText: '',
    aiQuestion: '',
    supplementText: '',
    accumulatedText: '',   // 多轮语音补充的累计文字
    workOrder: { typeId: '', typeName: '', content: '', phone: '' },
    repairTypes: [],
    typeNames: [],
    typeIndex: -1,
    phone: '',
    submitting: false,
    showSupplement: false,  // 追问阶段是否展示输入框
    showAIHint: false       // 录音阶段是否展示AI追问气泡
  },

  onLoad: function () {
    this.loadRepairTypes();
    var phone = wx.getStorageSync('user_phone') || '';
    if (phone) this.setData({ phone: phone, 'workOrder.phone': phone });
    // 延迟创建camera context，确保camera组件已渲染
    var self = this;
    setTimeout(function () {
      try { self.cameraCtx = wx.createCameraContext(); } catch (e) { console.error('camera ctx', e); }
    }, 300);
  },

  loadRepairTypes: function () {
    var self = this;
    wx.request({
      url: PMS_API + '/WY/GetWorkSheetType',
      method: 'POST', dataType: 'json',
      success: function (res) {
        if (res.data && res.data.data) {
          var list = res.data.data;
          self.setData({
            repairTypes: list,
            typeNames: list.map(function (i) { return i.wy_type_name; })
          });
        }
      }
    });
  },

  // ========== 拍照 ==========
  takePhoto: function () {
    var self = this;
    if (!this.cameraCtx) {
      try { this.cameraCtx = wx.createCameraContext(); } catch (e) {
        wx.showToast({ title: '相机初始化失败', icon: 'none' });
        return;
      }
    }
    this.cameraCtx.takePhoto({
      quality: 'high',
      success: function (res) {
        var photos = self.data.photos.concat([res.tempImagePath]);
        if (photos.length > 3) photos = photos.slice(0, 3);
        self.setData({ photos: photos, phase: 'reviewing' });
      },
      fail: function () {
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },

  retakePhoto: function () {
    var photos = this.data.photos;
    photos.pop();
    this.setData({ photos: photos, phase: 'camera' });
  },

  addMorePhoto: function () {
    this.setData({ phase: 'camera' });
  },

  goToRecording: function () {
    this.setData({ phase: 'recording' });
  },

  // ========== 录音 ==========
  startRecording: function () {
    var self = this;
    this.setData({ isRecording: true, recordingDuration: 0 });
    this._timer = setInterval(function () {
      self.setData({ recordingDuration: self.data.recordingDuration + 1 });
    }, 1000);
    this._rm = wx.getRecorderManager();
    this._rm.start({
      duration: 60000, sampleRate: 16000,
      numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3'
    });
  },

  stopRecording: function () {
    this.setData({ isRecording: false });
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    var self = this;
    if (this._rm) {
      this._rm.stop();
      this._rm.onStop(function (res) {
        self.setData({ audioPath: res.tempFilePath });
        self.startAnalyze();
      });
    }
  },

  // ========== AI分析（一步到位：NestJS同时做ASR+LLM） ==========
  startAnalyze: function () {
    var self = this;
    var audioPath = this.data.audioPath;
    var apiBase = config.API_BASE_URL;

    // 没有后端 或 没有录音，走文字输入
    if (!audioPath || !apiBase) {
      this.setData({
        phase: 'supplement',
        analyzing: false,
        aiQuestion: '请用文字描述报修问题（如：3楼B区空调不制冷）',
        showSupplement: true
      });
      return;
    }

    // 一步到位：上传音频到NestJS，同时完成ASR+LLM校验
    this.setData({ phase: 'analyzing', analyzing: true, analyzeStep: '语音识别+AI校验中...' });

    var accumulatedText = this.data.accumulatedText || '';
    wx.uploadFile({
      url: apiBase + '/repair/analyze',
      filePath: audioPath,
      name: 'audio',
      header: { 'Content-Type': 'multipart/form-data' },
      formData: { accumulatedText: accumulatedText },
      success: function (res) {
        var data;
        try { data = JSON.parse(res.data); } catch (e) { data = {}; }
        if (data.error) {
          // NestJS返回错误，降级到文字输入
          self.setData({
            phase: 'supplement',
            analyzing: false,
            aiQuestion: '识别失败：' + data.error + '，请用文字描述',
            showSupplement: true
          });
          return;
        }
        if (data.transcribedText) {
          // ASR+LLM成功，处理结果
          self.handleAnalyzeResult(data, data.transcribedText);
        } else {
          // 空文字
          self.setData({
            phase: 'recording',
            analyzing: false,
            aiQuestion: '没有听清楚，请再说一遍',
            audioPath: '',
            recordingDuration: 0,
            showAIHint: true
          });
          var s = self;
          setTimeout(function () { s.setData({ showAIHint: false }); }, 4000);
        }
      },
      fail: function (err) {
        console.error('[repair] analyze fail:', err);
        self.setData({
          phase: 'supplement',
          analyzing: false,
          aiQuestion: '服务不可用，请用文字描述报修问题',
          showSupplement: true
        });
      }
    });
  },

  submitSupplement: function () {
    var text = this.data.supplementText.trim();
    if (!text) { wx.showToast({ title: '请输入描述', icon: 'none' }); return; }
    this.setData({
      supplementText: '',
      phase: 'analyzing',
      analyzing: true,
      analyzeStep: 'AI信息校验中...'
    });
    // 文字补充直接走NestJS analyze接口（不传audio，只传supplementText）
    var self = this;
    var accumulatedText = this.data.accumulatedText || '';
    wx.request({
      url: config.API_BASE_URL + '/repair/analyze',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { supplementText: text, accumulatedText: accumulatedText },
      success: function (res) {
        if (res.data && res.data.transcribedText) {
          self.handleAnalyzeResult(res.data, text);
        } else {
          self.setData({
            workOrder: { typeId: '', typeName: '', content: text, phone: self.data.phone },
            transcribedText: text,
            accumulatedText: text,
            analyzing: false,
            phase: 'preview'
          });
        }
      },
      fail: function () {
        self.setData({
          workOrder: { typeId: '', typeName: '', content: text, phone: self.data.phone },
          transcribedText: text,
          accumulatedText: text,
          analyzing: false,
          phase: 'preview'
        });
      }
    });
  },

  handleAnalyzeResult: function (result, originalText) {
    var self = this;
    // 累积文字：把用户这轮说的加到accumulatedText里
    var acc = this.data.accumulatedText || '';
    if (acc) acc += '。';
    acc += originalText;

    // NestJS返回的三个字段
    var issue = result.issue || '';
    var location = result.location || '';
    var typeName = result.type || '物业维修';
    var isComplete = result.isComplete;
    var question = result.question || '';

    // 拼接完整工单描述：地点 + 内容
    var fullContent = '';
    if (location && issue) {
      fullContent = location + issue;
    } else if (issue) {
      fullContent = issue;
    } else if (location) {
      fullContent = location;
    } else {
      fullContent = acc;
    }

    var wo = {
      typeId: '',
      typeName: typeName,
      content: fullContent,
      phone: this.data.phone,
      issue: issue,
      location: location
    };

    // 从工单系统拉取的类型列表里匹配ID
    if (this.data.repairTypes.length > 0) {
      for (var i = 0; i < this.data.repairTypes.length; i++) {
        var sysName = this.data.repairTypes[i].wy_type_name;
        if (sysName === typeName || sysName.indexOf(typeName) >= 0 || typeName.indexOf(sysName) >= 0) {
          wo.typeId = this.data.repairTypes[i].wy_type_id;
          this.setData({ typeIndex: i });
          break;
        }
      }
      if (!wo.typeId) {
        wo.typeId = this.data.repairTypes[0].wy_type_id;
        this.setData({ typeIndex: 0 });
      }
    }

    this.setData({
      workOrder: wo,
      accumulatedText: acc,
      transcribedText: acc,
      analyzing: false
    });

    if (isComplete) {
      // 三个字段都齐全，进预览
      this.setData({ phase: 'preview' });
    } else {
      // 有缺失字段，回到语音输入阶段，AI追问缺失的那个字段
      this.setData({
        phase: 'recording',
        aiQuestion: question || '请补充报修信息',
        audioPath: '',
        recordingDuration: 0
      });
      if (question) {
        this.setData({ showAIHint: true });
        var s = this;
        setTimeout(function () { s.setData({ showAIHint: false }); }, 5000);
      }
    }
  },

  onSupplementInput: function (e) {
    this.setData({ supplementText: e.detail.value });
  },

  skipToManual: function () {
    this.setData({ phase: 'preview', workOrder: { typeId: '', typeName: '', content: this.data.transcribedText || '', phone: this.data.phone } });
  },

  // ========== 手动编辑 ==========
  onTypeChange: function (e) {
    var idx = e.detail.value;
    this.setData({
      typeIndex: idx,
      'workOrder.typeId': this.data.repairTypes[idx].wy_type_id,
      'workOrder.typeName': this.data.repairTypes[idx].wy_type_name
    });
  },
  onContentInput: function (e) {
    this.setData({ 'workOrder.content': e.detail.value });
  },
  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value, 'workOrder.phone': e.detail.value });
  },

  // 微信一键授权手机号
  onGetPhone: function (e) {
    var self = this;
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      return;
    }
    auth.getPhoneFromWechat(e).then(function (phone) {
      self.setData({ phone: phone, 'workOrder.phone': phone });
      wx.showToast({ title: '手机号已获取', icon: 'success' });
    }).catch(function (err) {
      console.error('getPhone error', err);
      wx.showToast({ title: '获取失败，请手动输入', icon: 'none' });
    });
  },
  editFromPreview: function () {
    // 从预览回到手动编辑（用form模式）
    this.setData({ phase: 'manual' });
  },

  goToPreviewFromManual: function () {
    var wo = this.data.workOrder;
    if (this.data.typeIndex < 0) { wx.showToast({ title: '请选择类型', icon: 'none' }); return; }
    if (!wo.content.trim()) { wx.showToast({ title: '请填写描述', icon: 'none' }); return; }
    if (!wo.phone.trim()) { wx.showToast({ title: '请填电话', icon: 'none' }); return; }
    this.setData({ phase: 'preview' });
  },

  // ========== 提交 ==========
  submitWorkOrder: function () {
    var self = this;
    var wo = this.data.workOrder;
    if (!wo.typeId) {
      // 没有类型ID，尝试从typeIndex取
      if (this.data.typeIndex >= 0 && this.data.repairTypes.length > 0) {
        wo.typeId = this.data.repairTypes[this.data.typeIndex].wy_type_id;
        wo.typeName = this.data.repairTypes[this.data.typeIndex].wy_type_name;
      } else {
        wx.showToast({ title: '请选择类型', icon: 'none' }); return;
      }
    }
    if (this.data.photos.length === 0) { wx.showToast({ title: '请拍照', icon: 'none' }); return; }
    if (!wo.phone.trim() || !/^1[3456789]\d{9}$/.test(wo.phone)) {
      wx.showToast({ title: '手机号不正确', icon: 'none' }); return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传照片...' });

    var uploadPromises = this.data.photos.map(function (p) {
      return self.uploadPhotoToPMS(p);
    });

    Promise.all(uploadPromises).then(function (accachIds) {
      wx.showLoading({ title: '提交工单...' });
      var strJson = JSON.stringify({
        q_title: '', q_content: wo.content, q_state: '0',
        wy_type: wo.typeId, oper_name: '', oper_id: '',
        state: 0, creater_phone: wo.phone,
        counter_id: parseInt(COUNTER_ID), ACCACHID_Lst: accachIds
      });
      return new Promise(function (resolve, reject) {
        wx.request({
          url: PMS_API + '/WY/InsertWorkSheet',
          method: 'POST', dataType: 'json',
          header: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: { str_json: strJson },
          success: function (res) { resolve(res.data); },
          fail: function (err) { reject(err); }
        });
      });
    }).then(function (pmsResult) {
      wx.hideLoading();
      self.setData({ submitting: false });
      wx.setStorageSync('user_phone', wo.phone);
      // PMS返回的q_id作为真实工单号
      var pmsQid = '';
      if (pmsResult && pmsResult.data) {
        try { var d = typeof pmsResult.data === 'string' ? JSON.parse(pmsResult.data) : pmsResult.data; pmsQid = d.q_id || ''; } catch (e) {}
      }
      var record = {
        id: pmsQid || ('WX' + Date.now()),
        q_id: pmsQid,
        type: wo.typeName, content: wo.content,
        phone: wo.phone, photos: self.data.photos,
        createTime: new Date().toLocaleString(), status: '待处理'
      };
      var list = wx.getStorageSync('repair_list') || [];
      list.unshift(record);
      wx.setStorageSync('repair_list', list);
      self.setData({ phase: 'success', workOrderId: record.id });
    }).catch(function (err) {
      console.error('提交失败', err);
      wx.hideLoading();
      self.setData({ submitting: false });
      wx.showToast({ title: '提交失败', icon: 'none' });
    });
  },

  uploadPhotoToPMS: function (filePath) {
    return new Promise(function (resolve, reject) {
      wx.getFileSystemManager().readFile({
        filePath: filePath, encoding: 'base64',
        success: function (res) {
          var guid = '';
          for (var i = 1; i <= 32; i++) {
            guid += Math.floor(Math.random() * 16).toString(16);
            if (i == 8 || i == 12 || i == 16 || i == 20) guid += '-';
          }
          // PMS后端用 Split(',')[1] 取base64部分，所以必须带 Data URL 前缀
          var dataUrl = 'data:image/jpeg;base64,' + res.data;
          wx.request({
            url: PMS_API + '/WY/UploadFile_APP',
            method: 'POST', dataType: 'json',
            header: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: { base64Str: dataUrl, fileName: guid + '.jpg', type: 0, creater_id: '' },
            success: function (res2) {
              console.log('[upload] PMS response:', JSON.stringify(res2.data).substring(0, 200));
              if (res2.data && res2.data.code == '-1') {
                reject(new Error(res2.data.msg || '上传失败'));
                return;
              }
              try {
                var d = typeof res2.data.data === 'string' ? JSON.parse(res2.data.data) : res2.data.data;
                resolve(d.accach_id);
              } catch (e) { reject(new Error('解析上传响应失败')); }
            },
            fail: function (err) {
              console.error('[upload] PMS request fail:', err);
              reject(err);
            }
          });
        },
        fail: function (err) {
          console.error('[upload] readFile fail:', err);
          reject(err);
        }
      });
    });
  },

  // ========== 重置/导航 ==========
  resetAll: function () {
    this.setData({
      phase: 'camera', photos: [], audioPath: '',
      recordingDuration: 0, supplementText: '', transcribedText: '',
      accumulatedText: '', aiQuestion: '', showSupplement: false, showAIHint: false,
      workOrder: { typeId: '', typeName: '', content: '', phone: this.data.phone },
      typeIndex: -1
    });
  },

  goHome: function () {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._rm) { try { this._rm.stop(); } catch (e) {} }
    this.setData({ isRecording: false, analyzing: false, submitting: false });
    wx.switchTab({ url: '/pages/index/index' });
  },

  goToList: function () { wx.navigateTo({ url: '/subpackages/repair-detail/pages/list/list' }); },

  onUnload: function () { if (this._timer) clearInterval(this._timer); }
});
