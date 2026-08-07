var config = require('../../../../config/env.js');

Page({
  data: {
    examId: '',
    examTitle: '',
    exam: null,
    questions: [],
    // selMatrix: 二维布尔矩阵 selMatrix[qIndex] = [true, false, false, true]
    // 直接用布尔值，WXML用三元表达式就能判断，不需要indexOf/WXS
    selMatrix: [],
    currentIndex: 0,
    remainingSeconds: 0,
    remainingText: '',
    loading: true,
    submitting: false,
    showAnswerCard: false,
    timer: null
  },

  onLoad: function (options) {
    this.setData({ examId: options.id, examTitle: options.title || '考试' });
    this.loadQuestions(options.id);
  },

  onUnload: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  loadQuestions: function (examId) {
    var self = this;
    wx.request({
      url: config.config.API_BASE_URL + '/exam/' + examId + '/questions',
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        console.log('[exam] questions response:', res.statusCode, res.data);
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var d = res.data.data;
          var questions = [];
          var selMatrix = [];
          for (var i = 0; i < d.questions.length; i++) {
            var q = d.questions[i];
            questions.push({
              id: q.id,
              type: q.type,
              content: q.content,
              options: q.options,
              score: q.score
            });
            // 初始化全false的选中矩阵
            var row = [];
            for (var j = 0; j < q.options.length; j++) {
              row.push(false);
            }
            selMatrix.push(row);
          }
          self.setData({
            exam: d.exam,
            questions: questions,
            selMatrix: selMatrix,
            remainingSeconds: d.exam.duration * 60,
            remainingText: self.formatTime(d.exam.duration * 60),
            loading: false
          });
          self.startTimer();
        } else {
          self.setData({ loading: false });
          wx.showModal({
            title: '加载失败',
            content: 'HTTP ' + res.statusCode + ' | ' + JSON.stringify(res.data).substring(0, 200),
            showCancel: false
          });
        }
      },
      fail: function (err) {
        console.error('[exam] request failed:', err);
        self.setData({ loading: false });
        wx.showModal({
          title: '网络错误',
          content: 'URL: ' + config.config.API_BASE_URL + '/exam/' + examId + '/questions\n错误: ' + (err.errMsg || JSON.stringify(err)),
          showCancel: false
        });
      }
    });
  },

  startTimer: function () {
    var self = this;
    var timer = setInterval(function () {
      var remaining = self.data.remainingSeconds - 1;
      if (remaining <= 0) {
        clearInterval(timer);
        self.setData({ remainingSeconds: 0, remainingText: '00:00' });
        wx.showModal({
          title: '时间到',
          content: '考试时间已结束，将自动提交',
          showCancel: false,
          success: function () { self.doSubmit(); }
        });
        return;
      }
      self.setData({
        remainingSeconds: remaining,
        remainingText: self.formatTime(remaining)
      });
    }, 1000);
    self.setData({ timer: timer });
  },

  formatTime: function (seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  selectOption: function (e) {
    var qIndex = this.data.currentIndex;
    var optIndex = e.currentTarget.dataset.opt;
    var q = this.data.questions[qIndex];
    var matrix = this.data.selMatrix;
    // 深拷贝当前行
    var row = matrix[qIndex].slice();

    if (q.type === 'single' || q.type === 'judge') {
      // 单选/判断：只选当前，其他全false
      for (var i = 0; i < row.length; i++) {
        row[i] = (i === optIndex);
      }
    } else if (q.type === 'multiple') {
      // 多选：切换当前
      row[optIndex] = !row[optIndex];
    }

    // 用路径setData确保视图更新
    var update = {};
    update['selMatrix[' + qIndex + ']'] = row;
    this.setData(update);
  },

  goPrev: function () {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 });
    }
  },

  goNext: function () {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 });
    }
  },

  jumpTo: function (e) {
    var index = e.currentTarget.dataset.index;
    this.setData({ currentIndex: index, showAnswerCard: false });
  },

  toggleAnswerCard: function () {
    this.setData({ showAnswerCard: !this.data.showAnswerCard });
  },

  // 检查某题是否已答（供WXML用）
  isAnswered: function (qIndex) {
    var row = this.data.selMatrix[qIndex];
    if (!row) return false;
    for (var i = 0; i < row.length; i++) {
      if (row[i]) return true;
    }
    return false;
  },

  submitExam: function () {
    var unanswered = 0;
    var matrix = this.data.selMatrix;
    for (var i = 0; i < this.data.questions.length; i++) {
      var answered = false;
      if (matrix[i]) {
        for (var j = 0; j < matrix[i].length; j++) {
          if (matrix[i][j]) { answered = true; break; }
        }
      }
      if (!answered) unanswered++;
    }
    var self = this;
    if (unanswered > 0) {
      wx.showModal({
        title: '确认提交',
        content: '还有' + unanswered + '题未作答，确定提交吗？',
        success: function (res) {
          if (res.confirm) self.doSubmit();
        }
      });
    } else {
      wx.showModal({
        title: '确认提交',
        content: '确定提交考试吗？',
        success: function (res) {
          if (res.confirm) self.doSubmit();
        }
      });
    }
  },

  doSubmit: function () {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.setData({ submitting: false });
      return;
    }

    if (this.data.timer) {
      clearInterval(this.data.timer);
    }

    var totalDuration = this.data.exam ? this.data.exam.duration * 60 : 0;
    var usedDuration = totalDuration - this.data.remainingSeconds;

    // 把布尔矩阵转成选中索引数组
    var answers = [];
    var matrix = this.data.selMatrix;
    for (var i = 0; i < this.data.questions.length; i++) {
      var selected = [];
      if (matrix[i]) {
        for (var j = 0; j < matrix[i].length; j++) {
          if (matrix[i][j]) selected.push(j);
        }
      }
      answers.push({
        questionId: this.data.questions[i].id,
        selected: selected
      });
    }

    var self = this;
    wx.request({
      url: config.config.API_BASE_URL + '/exam/submit',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        examId: self.data.examId,
        phone: phone,
        answers: answers,
        duration: usedDuration > 0 ? usedDuration : 0
      },
      success: function (res) {
        console.log('[exam] submit response:', res.statusCode, res.data);
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var submission = res.data.data;
          var percentage = Math.round((submission.score / submission.totalScore) * 100);
          wx.redirectTo({
            url: '/subpackages/exam/pages/result/result?submissionId=' + submission.id + '&percentage=' + percentage + '&passed=' + submission.passed
          });
        } else {
          wx.showModal({
            title: '提交失败',
            content: 'HTTP ' + res.statusCode + ' | ' + JSON.stringify(res.data).substring(0, 200),
            showCancel: false
          });
          self.setData({ submitting: false });
        }
      },
      fail: function (err) {
        wx.showModal({
          title: '网络错误',
          content: err.errMsg || JSON.stringify(err),
          showCancel: false
        });
        self.setData({ submitting: false });
      }
    });
  }
});
