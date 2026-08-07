var config = require('../../../../config/env.js');

Page({
  data: {
    courseId: '',
    course: null,
    lessons: [],
    currentLesson: null,
    currentLessonIndex: 0,
    progressMap: {},
    loading: true,
    videoContext: null
  },

  onLoad: function (options) {
    this.setData({ courseId: options.id });
    this.loadCourseDetail(options.id);
  },

  loadCourseDetail: function (id) {
    var self = this;
    var phone = wx.getStorageSync('user_phone') || '';

    wx.request({
      url: config.config.API_BASE_URL + '/training/courses/' + id,
      method: 'GET',
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var course = res.data.data;
          var lessons = course.lessons || [];
          self.setData({
            course: course,
            lessons: lessons,
            currentLesson: lessons.length > 0 ? lessons[0] : null,
            currentLessonIndex: 0,
            loading: false
          });
          if (lessons.length > 0) {
            self.setData({ videoContext: wx.createVideoContext('trainingVideo') });
          }
          if (phone) {
            self.loadProgress(id, phone);
          }
        } else {
          self.setData({ loading: false });
          wx.showToast({ title: '课程不存在', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  loadProgress: function (courseId, phone) {
    var self = this;
    wx.request({
      url: config.config.API_BASE_URL + '/training/progress/' + courseId + '?phone=' + phone,
      method: 'GET',
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var records = res.data.data || [];
          var pmap = {};
          for (var i = 0; i < records.length; i++) {
            pmap[records[i].lessonId] = {
              progress: records[i].progress,
              completed: records[i].completed
            };
          }
          self.setData({ progressMap: pmap });
        }
      }
    });
  },

  selectLesson: function (e) {
    var index = e.currentTarget.dataset.index;
    var lesson = this.data.lessons[index];
    this.setData({
      currentLesson: lesson,
      currentLessonIndex: index
    });
  },

  markArticleRead: function () {
    if (!this.data.currentLesson) return;
    this.reportProgress(100, 0);
  },

  onTimeUpdate: function (e) {
    var currentTime = e.detail.currentTime;
    var duration = e.detail.duration;
    var progress = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

    // 每10%进度上报一次
    var lastReported = this._lastReportedProgress || 0;
    if (progress - lastReported >= 10) {
      this._lastReportedProgress = progress;
      this.reportProgress(progress, Math.round(currentTime));
    }
  },

  onVideoEnded: function () {
    this.reportProgress(100, this.data.currentLesson.duration || 0);
    // 自动播放下一课
    var nextIndex = this.data.currentLessonIndex + 1;
    if (nextIndex < this.data.lessons.length) {
      var nextLesson = this.data.lessons[nextIndex];
      this.setData({
        currentLesson: nextLesson,
        currentLessonIndex: nextIndex
      });
    }
  },

  reportProgress: function (progress, watchedDuration) {
    var phone = wx.getStorageSync('user_phone') || '';
    if (!phone) return;

    var self = this;
    wx.request({
      url: config.config.API_BASE_URL + '/training/progress',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        courseId: self.data.courseId,
        lessonId: self.data.currentLesson.id,
        phone: phone,
        progress: progress,
        watchedDuration: watchedDuration
      },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          var record = res.data.data;
          var pmap = self.data.progressMap;
          pmap[record.lessonId] = {
            progress: record.progress,
            completed: record.completed
          };
          self.setData({ progressMap: pmap });
        }
      }
    });
  },

  goAssistant: function () {
    var course = this.data.course;
    var lesson = this.data.currentLesson;
    if (!course) return;

    var title = encodeURIComponent(course.title || '');
    var desc = encodeURIComponent(course.description || '');
    var lessonContent = '';
    if (lesson && lesson.type === 'article' && lesson.content) {
      // 图文课时：传纯文本（截取前2000字符）
      lessonContent = encodeURIComponent(lesson.content.substring(0, 2000));
    } else if (lesson) {
      lessonContent = encodeURIComponent(lesson.title || '');
    }

    wx.navigateTo({
      url: '/subpackages/training/pages/assistant/assistant?courseId=' + this.data.courseId + '&title=' + title + '&desc=' + desc + '&lesson=' + lessonContent
    });
  }
});
