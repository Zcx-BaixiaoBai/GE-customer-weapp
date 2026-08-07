// This file exports the admin HTML as a plain string, avoiding template literal escaping issues
export const ADMIN_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>金鹰物业 - 后台管理</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Segoe UI',sans-serif;background:#f0f2f5;color:#1a1a2e;font-size:14px}
.header{background:#1a1a2e;color:#fff;padding:16px 32px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.header h1{font-size:20px}
.header .badge{background:#3370ff;padding:3px 10px;border-radius:10px;font-size:11px}
.tabs{display:flex;background:#fff;border-bottom:1px solid #e4e9f0;padding:0 32px;position:sticky;top:53px;z-index:9}
.tab{padding:14px 24px;cursor:pointer;border-bottom:3px solid transparent;color:#5c6b7a}
.tab.active{color:#3370ff;border-bottom-color:#3370ff;font-weight:600}
.content{padding:24px;max-width:1200px;margin:0 auto}
.panel{display:none}.panel.active{display:block}
.card{background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.card h2{font-size:17px;margin-bottom:16px}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:12px;color:#8a95a7;margin-bottom:4px}
.fg input,.fg select,.fg textarea{width:100%;padding:8px 10px;border:1px solid #e4e9f0;border-radius:6px;font-size:14px;outline:none}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:#3370ff}
.row{display:flex;gap:14px;flex-wrap:wrap}
.row .rg{flex:1;min-width:180px}
.btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px}
.btn-p{background:#3370ff;color:#fff}.btn-s{background:#00b578;color:#fff}
.btn-w{background:#ff8f1f;color:#fff}.btn-d{background:#e9556e;color:#fff}
.btn:hover{opacity:.85}
.btn:disabled{opacity:.5;cursor:not-allowed}
.empty{text-align:center;padding:36px;color:#8a95a7}
.qc{background:#fff;border:1px solid #eef0f3;border-radius:10px;padding:18px;margin-bottom:14px}
.qc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap}
.tag{font-size:11px;padding:3px 8px;border-radius:4px;color:#fff}
.t-single{background:#3370ff}.t-multiple{background:#9b59b6}.t-judge{background:#ff8f1f}
.opt{display:flex;align-items:center;gap:8px;margin:3px 0;padding:5px 10px;border-radius:4px}
.opt-correct{background:#e8f8f0}.opt-wrong{background:#f8f9fa}
.opt input[type=checkbox]{width:16px;height:16px}
.opt input[type=text]{flex:1;padding:4px 6px;border:1px solid #e4e9f0;border-radius:4px}
.exp{margin-top:6px;padding:6px 10px;background:#fff7e8;border-radius:4px;font-size:12px;color:#8a6d3b}
.lesson-row{border:1px solid #eef0f3;border-radius:8px;padding:12px;margin-bottom:10px}
.lesson-type-badge{font-size:11px;padding:2px 6px;border-radius:3px;color:#fff}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:20px}
.stat-box{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.stat-num{font-size:32px;font-weight:700;color:#1a1a2e}
.stat-label{font-size:13px;color:#8a95a7;margin-top:4px}
.stat-box.green .stat-num{color:#00b578}
.stat-box.blue .stat-num{color:#3370ff}
.stat-box.orange .stat-num{color:#ff8f1f}
.stat-box.red .stat-num{color:#e9556e}
.stat-table{width:100%;border-collapse:collapse}
.stat-table th{text-align:left;padding:8px 12px;background:#f8f9fa;font-size:12px;color:#8a95a7;border-bottom:1px solid #eef0f3}
.stat-table td{padding:10px 12px;border-bottom:1px solid #f8f9fa;font-size:13px}
.stat-table tr:hover td{background:#fafbfc}
.filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.filter-bar select{padding:6px 10px;border:1px solid #e4e9f0;border-radius:6px;font-size:13px}
</style>
</head>
<body>
<div class="header"><h1>金鹰物业</h1><span class="badge">后台管理</span></div>
<div class="tabs">
  <div class="tab active" onclick="sw('courses')">培训课程</div>
  <div class="tab" onclick="sw('questions')">题库管理</div>
  <div class="tab" onclick="sw('exams')">考试管理</div>
  <div class="tab" onclick="sw('stats')">统计看板</div>
</div>
<div class="content">

<div class="panel active" id="p-courses">
  <div class="card">
    <h2>新建课程</h2>
    <div class="row">
      <div class="rg fg"><label>课程标题</label><input id="ct" placeholder="如：消防安全培训"></div>
      <div class="rg fg" style="max-width:200px"><label>分类</label><input id="cc" placeholder="安全"></div>
    </div>
    <div class="fg"><label>课程描述</label><textarea id="cd" rows="2" placeholder="课程简介"></textarea></div>
    <button class="btn btn-p" onclick="createCourse()">创建课程</button>
  </div>
  <div class="card"><h2>课程列表</h2><div id="course-list"></div></div>
</div>

<div class="panel" id="p-questions">
  <div class="card">
    <h2>新建题目</h2>
    <div class="row">
      <div class="rg fg" style="max-width:150px"><label>题型</label><select id="qt" onchange="renderOpts()"><option value="single">单选题</option><option value="multiple">多选题</option><option value="judge">判断题</option></select></div>
      <div class="rg fg" style="max-width:100px"><label>分值</label><input id="qs" type="number" value="2" min="1"></div>
      <div class="rg fg" style="max-width:150px"><label>分类</label><input id="qc2" placeholder="安全"></div>
    </div>
    <div class="fg"><label>题干</label><textarea id="qct" rows="2" placeholder="输入题目内容"></textarea></div>
    <div class="fg"><label>选项（勾选正确答案）</label><div id="qopts"></div><button class="btn btn-w" style="font-size:11px;padding:4px 12px" onclick="addOpt()">+添加选项</button></div>
    <div class="fg"><label>解析（可选）</label><textarea id="qe" rows="1" placeholder="答案解析"></textarea></div>
    <button class="btn btn-p" onclick="createQ()">创建题目</button>
  </div>
  <div class="card" style="border:2px dashed #9b59b6">
    <h2>🤖 AI生成题目</h2>
    <div class="row">
      <div class="rg fg"><label>主题</label><input id="ait" placeholder="消防安全/设备操作/应急处置"></div>
      <div class="rg fg" style="max-width:100px"><label>数量</label><input id="aic" type="number" value="5" min="1" max="20"></div>
    </div>
    <button class="btn btn-s" onclick="aiGen()" id="aibtn">🤖 AI生成</button>
    <span id="aist" style="margin-left:10px;font-size:13px;color:#8a95a7"></span>
  </div>
  <div class="card">
    <h2>题库列表</h2>
    <div class="filter-bar">
      <label style="font-size:12px;color:#8a95a7">按分类筛选:</label>
      <select id="qfilter" onchange="loadQ()"><option value="">全部分类</option></select>
    </div>
    <div id="qlist"></div>
  </div>
</div>

<div class="panel" id="p-exams">
  <div class="card">
    <h2>新建考试</h2>
    <div class="row">
      <div class="rg fg"><label>考试标题</label><input id="et" placeholder="消防安全考试"></div>
      <div class="rg fg" style="max-width:120px"><label>时长(分钟)</label><input id="ed" type="number" value="30" min="1"></div>
      <div class="rg fg" style="max-width:100px"><label>及格分</label><input id="ep" type="number" value="60" min="0" max="100"></div>
    </div>
    <div class="fg">
      <label>选择题目</label>
      <div class="filter-bar" style="margin-bottom:8px">
        <label style="font-size:12px;color:#8a95a7">按分类筛选:</label>
        <select id="epickfilter" onchange="renderPick()"><option value="">全部分类</option></select>
        <label style="font-size:12px;color:#8a95a7;margin-left:8px">已选:</label>
        <span id="pickcount" style="font-size:13px;font-weight:600;color:#3370ff">0</span>题
      </div>
      <div id="epick"></div>
    </div>
    <button class="btn btn-p" onclick="createExam()">创建考试</button>
  </div>
  <div class="card"><h2>考试列表</h2><div id="elist"></div></div>
</div>

<div class="panel" id="p-stats">
  <div class="card">
    <h2>学习统计</h2>
    <div class="fg" style="max-width:300px">
      <label>查询手机号（留空看全局）</label>
      <div style="display:flex;gap:8px">
        <input id="stphone" placeholder="输入手机号查询" onkeyup="if(event.key==='Enter')loadStats()">
        <button class="btn btn-p" onclick="loadStats()">查询</button>
      </div>
    </div>
    <div class="stat-grid" id="train-stats"></div>
    <div id="train-detail"></div>
  </div>
  <div class="card">
    <h2>考试统计</h2>
    <div class="stat-grid" id="exam-stats"></div>
    <div id="exam-detail"></div>
  </div>
  <div class="card">
    <h2>每课程学习明细</h2>
    <p style="font-size:12px;color:#8a95a7;margin-bottom:10px">每个课程的学习人数、完成情况、平均进度、学员列表</p>
    <div id="course-detail-stats"></div>
  </div>
  <div class="card">
    <h2>每考试统计明细</h2>
    <p style="font-size:12px;color:#8a95a7;margin-bottom:10px">每个考试的参与人数、通过率、平均分、学员列表</p>
    <div id="exam-detail-stats"></div>
  </div>
  <div class="card">
    <h2>题库概况</h2>
    <div id="question-stats"></div>
  </div>
</div>

</div>

<script>
var B = '/api/admin';
var ORIGIN = location.origin;
var allQuestions = [];
var allCourses = [];

function sw(n) {
  document.querySelectorAll('.tab').forEach(function(t, i) {
    t.classList.toggle('active', i === ['courses','questions','exams','stats'].indexOf(n));
  });
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'p-' + n);
  });
  if (n === 'courses') loadCourses();
  if (n === 'questions') { loadQ(); renderOpts(); }
  if (n === 'exams') { loadPick(); loadExams(); }
  if (n === 'stats') loadStats();
}

function esc(s) { return s ? String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }
function val(id, v) {
  if (v !== undefined) { document.getElementById(id).value = v; return; }
  var e = document.getElementById(id);
  return e ? e.value : '';
}
function api(url, opts) {
  opts = opts || {};
  var body = opts.body ? JSON.stringify(opts.body) : undefined;
  return fetch(url, {
    method: opts.method || 'GET',
    headers: body ? {'Content-Type': 'application/json'} : undefined,
    body: body
  }).then(function(r) { return r.json(); });
}

// ===== 统计看板 =====
function loadStats() {
  var phone = val('stphone') || '';
  loadTrainStats(phone);
  loadExamStats(phone);
  loadCourseDetailStats(phone);
  loadExamDetailStats();
  loadQuestionStats();
}

function loadTrainStats(phone) {
  var url = B + '/api/training/stats' + (phone ? '?phone=' + encodeURIComponent(phone) : '');
  // 后端需要phone参数，如果没传phone就用空字符串
  api(url).then(function(r) {
    if (r.code !== 0) { document.getElementById('train-stats').innerHTML = '<div class="empty">需要手机号查询</div>'; return; }
    var d = r.data || {};
    var h = '';
    h += statBox('green', d.completedCourses || 0, '已完成课程');
    h += statBox('blue', d.totalCourses || 0, '总课程数');
    h += statBox('orange', Math.round((d.totalWatchedDuration || 0) / 60), '学习时长(分)');
    h += statBox('red', (d.currentLearning || []).length, '进行中课程');
    document.getElementById('train-stats').innerHTML = h;
    // 进行中详情
    var cl = d.currentLearning || [];
    var dh = '';
    if (cl.length === 0) {
      dh = '<div class="empty">暂无进行中的课程</div>';
    } else {
      dh = '<table class="stat-table"><tr><th>课程</th><th>进度</th><th>已学时长</th></tr>';
      cl.forEach(function(c) {
        dh += '<tr><td>' + esc(c.title) + '</td><td>' + (c.progress||0) + '%</td><td>' + Math.round((c.watchedDuration||0)/60) + '分钟</td></tr>';
      });
      dh += '</table>';
    }
    document.getElementById('train-detail').innerHTML = dh;
  }).catch(function(e) {
    document.getElementById('train-stats').innerHTML = '<div class="empty">加载失败: ' + e + '</div>';
  });
}

function loadExamStats(phone) {
  if (!phone) {
    document.getElementById('exam-stats').innerHTML = '<div class="empty">请输入手机号查询考试统计</div>';
    document.getElementById('exam-detail').innerHTML = '';
    return;
  }
  api(B + '/api/exam/stats?phone=' + encodeURIComponent(phone)).then(function(r) {
    if (r.code !== 0) { document.getElementById('exam-stats').innerHTML = '<div class="empty">加载失败</div>'; return; }
    var d = r.data || {};
    var h = '';
    h += statBox('green', d.avgScore || 0, '平均分');
    h += statBox('blue', d.totalSubmissions || 0, '考试次数');
    h += statBox('orange', d.passRate || 0, '通过率(%)');
    h += statBox('red', d.passedCount || 0, '通过次数');
    document.getElementById('exam-stats').innerHTML = h;
    var rs = d.recentSubmissions || [];
    var dh = '';
    if (rs.length === 0) {
      dh = '<div class="empty">暂无考试记录</div>';
    } else {
      dh = '<h2 style="margin-top:16px;margin-bottom:10px">最近考试记录</h2>';
      dh += '<table class="stat-table"><tr><th>考试</th><th>分数</th><th>是否通过</th><th>用时</th><th>时间</th></tr>';
      rs.forEach(function(s) {
        var pass = s.passed ? '<span style="color:#00b578">通过</span>' : '<span style="color:#e9556e">未通过</span>';
        dh += '<tr><td>' + esc(s.examTitle || s.examId) + '</td><td>' + s.score + '</td><td>' + pass + '</td><td>' + Math.round((s.duration||0)/60) + '分</td><td>' + new Date(s.submittedAt).toLocaleString() + '</td></tr>';
      });
      dh += '</table>';
    }
    document.getElementById('exam-detail').innerHTML = dh;
  });
}

function loadCourseDetailStats(phone) {
  var url = B + '/api/training/course-stats' + (phone ? '?phone=' + encodeURIComponent(phone) : '');
  api(url).then(function(r) {
    if (r.code !== 0) { document.getElementById('course-detail-stats').innerHTML = '<div class="empty">加载失败</div>'; return; }
    var courses = r.data || [];
    if (courses.length === 0) { document.getElementById('course-detail-stats').innerHTML = '<div class="empty">暂无课程</div>'; return; }
    var h = '';
    courses.forEach(function(c) {
      h += '<div class="qc">' +
        '<div class="qc-head">' +
          '<div style="font-size:16px;font-weight:600">' + esc(c.title) + '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<span class="tag t-single">' + (c.category || '未分类') + '</span>' +
            '<span style="font-size:12px;color:#8a95a7">' + c.totalLessons + '课时</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-grid" style="margin-bottom:12px">' +
          statBox('blue', c.learnerCount, '学习人数') +
          statBox('green', c.completedCount, '已学完') +
          statBox('orange', c.avgProgress, '平均进度(%)') +
          statBox('red', Math.round((c.totalDuration||0)/60), '总时长(分)') +
        '</div>';
      // 学员明细表
      if (c.learners && c.learners.length > 0) {
        h += '<table class="stat-table"><tr><th>手机号</th><th>已学课时</th><th>学习时长</th><th>最后活跃</th></tr>';
        c.learners.forEach(function(l) {
          var pct = c.totalLessons > 0 ? Math.round(l.completed/c.totalLessons*100) : 0;
          h += '<tr><td>' + esc(l.phone) + '</td><td>' + l.completed + '/' + c.totalLessons + ' (' + pct + '%)</td><td>' + Math.round((l.watchedDuration||0)/60) + '分</td><td>' + (l.lastActive || '-') + '</td></tr>';
        });
        h += '</table>';
      } else {
        h += '<div class="empty" style="padding:16px">暂无学习记录</div>';
      }
      h += '</div>';
    });
    document.getElementById('course-detail-stats').innerHTML = h;
  });
}

function loadExamDetailStats() {
  api(B + '/api/exam/exam-stats').then(function(r) {
    if (r.code !== 0) { document.getElementById('exam-detail-stats').innerHTML = '<div class="empty">加载失败</div>'; return; }
    var exams = r.data || [];
    if (exams.length === 0) { document.getElementById('exam-detail-stats').innerHTML = '<div class="empty">暂无考试</div>'; return; }
    var h = '';
    exams.forEach(function(e) {
      var st = e.status === 'published' ? '已发布' : '草稿';
      h += '<div class="qc">' +
        '<div class="qc-head">' +
          '<div style="font-size:16px;font-weight:600">' + esc(e.title) + '</div>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<span style="font-size:12px;color:' + (e.status === 'published' ? '#00b578' : '#8a95a7') + '">' + st + '</span>' +
            '<span style="font-size:12px;color:#8a95a7">' + e.questionCount + '题 / ' + e.duration + '分钟</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-grid" style="margin-bottom:12px">' +
          statBox('blue', e.uniqueLearners, '参与人数') +
          statBox('green', e.passedCount, '通过人数') +
          statBox('orange', e.avgScore, '平均分') +
          statBox('red', e.passRate, '通过率(%)') +
        '</div>';
      // 学员明细表
      if (e.learners && e.learners.length > 0) {
        h += '<table class="stat-table"><tr><th>手机号</th><th>考试次数</th><th>最佳成绩</th><th>是否通过</th><th>最后考试</th></tr>';
        e.learners.forEach(function(l) {
          var pass = l.passed ? '<span style="color:#00b578">通过</span>' : '<span style="color:#e9556e">未通过</span>';
          h += '<tr><td>' + esc(l.phone) + '</td><td>' + l.attempts + '</td><td>' + l.bestScore + '</td><td>' + pass + '</td><td>' + (l.lastAttempt || '-') + '</td></tr>';
        });
        h += '</table>';
      } else {
        h += '<div class="empty" style="padding:16px">暂无考试记录</div>';
      }
      h += '</div>';
    });
    document.getElementById('exam-detail-stats').innerHTML = h;
  });
}

function loadQuestionStats() {
  api(B + '/api/exam/questions').then(function(r) {
    allQuestions = r.data || [];
    var byCat = {};
    var byType = { single: 0, multiple: 0, judge: 0 };
    allQuestions.forEach(function(q) {
      var cat = q.category || '未分类';
      byCat[cat] = (byCat[cat] || 0) + 1;
      byType[q.type] = (byType[q.type] || 0) + 1;
    });
    var h = '<div class="stat-grid">';
    h += statBox('blue', allQuestions.length, '题目总数');
    h += statBox('green', byType.single, '单选题');
    h += statBox('orange', byType.judge, '判断题');
    h += statBox('red', byType.multiple, '多选题');
    h += '</div>';
    h += '<h2 style="margin-top:16px;margin-bottom:10px">按分类分布</h2>';
    h += '<table class="stat-table"><tr><th>分类</th><th>题目数</th></tr>';
    Object.keys(byCat).forEach(function(cat) {
      h += '<tr><td>' + esc(cat) + '</td><td>' + byCat[cat] + '</td></tr>';
    });
    h += '</table>';
    document.getElementById('question-stats').innerHTML = h;
  });
}

function statBox(color, num, label) {
  return '<div class="stat-box ' + color + '"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + '</div></div>';
}

// ===== 课程 =====
function loadCourses() {
  api(B + '/api/training/courses').then(function(r) {
    allCourses = r.data || [];
    var h = '';
    if (allCourses.length === 0) h = '<div class="empty">暂无课程，在上方创建</div>';
    allCourses.forEach(function(c) {
      h += '<div class="qc">' +
        '<div class="qc-head">' +
          '<input type="text" value="' + esc(c.title) + '" data-cid="' + c.id + '" data-field="title" style="font-size:16px;font-weight:600;border:1px solid transparent;border-radius:4px;padding:4px 8px;flex:1" onblur="updCourse(this)">' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-w" style="font-size:11px;padding:3px 10px" onclick="toggleLessons(\'' + c.id + '\')">课时</button>' +
            '<button class="btn btn-d" style="font-size:11px;padding:3px 10px" onclick="delCourse(\'' + c.id + '\')">删除</button>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#8a95a7;margin-bottom:8px">分类: <input type="text" value="' + esc(c.category) + '" data-cid="' + c.id + '" data-field="category" style="border:1px solid transparent;border-radius:4px;padding:2px 6px;width:100px" onblur="updCourse(this)"> | 课时数: ' + (c.lessons||[]).length + '</div>' +
        '<textarea data-cid="' + c.id + '" data-field="description" style="width:100%;border:1px solid transparent;border-radius:4px;padding:4px 8px;font-size:13px;color:#5c6b7a" rows="1" onblur="updCourse(this)">' + esc(c.description) + '</textarea>' +
        '<div id="lessons-' + c.id + '" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #f0f2f5"></div>' +
      '</div>';
    });
    document.getElementById('course-list').innerHTML = h;
  });
}

function updCourse(inp) {
  var cid = inp.dataset.cid;
  var field = inp.dataset.field;
  var v = inp.value;
  api(B + '/api/training/courses/' + cid, {method: 'PUT', body: {[field]: v}});
}

function delCourse(id) {
  if (!confirm('确认删除课程及其所有课时？')) return;
  api(B + '/api/training/courses/' + id, {method: 'DELETE'}).then(function() { loadCourses(); });
}

function toggleLessons(cid) {
  var el = document.getElementById('lessons-' + cid);
  if (el.style.display === 'none') { el.style.display = 'block'; loadLessons(cid); }
  else { el.style.display = 'none'; }
}

function loadLessons(cid) {
  api(B + '/api/training/courses/' + cid + '/lessons').then(function(r) {
    var lessons = r.data || [];
    var h = '<div style="font-size:14px;font-weight:600;margin-bottom:8px">课时列表</div>';
    if (lessons.length === 0) h += '<div class="empty">暂无课时，在下方添加</div>';
    lessons.forEach(function(l) {
      var isVideo = l.type !== 'article';
      h += '<div class="lesson-row">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<span class="lesson-type-badge" style="' + (isVideo ? 'background:#3370ff' : 'background:#00b578') + '">' + (isVideo ? '视频' : '图文') + '</span>' +
          '<input type="text" value="' + esc(l.title) + '" placeholder="课时标题" data-lid="' + l.id + '" data-cid="' + cid + '" data-field="title" style="flex:1;padding:6px 8px;border:1px solid #e4e9f0;border-radius:4px;font-weight:500" onblur="updLesson(this)">' +
          '<button class="btn btn-d" style="font-size:10px;padding:2px 8px" onclick="delLesson(\'' + cid + '\',\'' + l.id + '\')">删</button>' +
        '</div>';
      if (isVideo) {
        h += '<div style="display:flex;gap:8px;margin-bottom:6px;align-items:center;flex-wrap:wrap">' +
          '<input type="text" value="' + esc(l.videoUrl) + '" placeholder="视频URL" data-lid="' + l.id + '" data-cid="' + cid + '" data-field="videoUrl" style="flex:1;min-width:200px;padding:6px 8px;border:1px solid #e4e9f0;border-radius:4px;font-size:12px" onblur="updLesson(this)">' +
          '<input type="number" value="' + (l.duration||0) + '" placeholder="秒" data-lid="' + l.id + '" data-cid="' + cid + '" data-field="duration" style="width:80px;padding:6px;border:1px solid #e4e9f0;border-radius:4px;font-size:12px" onblur="updLesson(this)">' +
          '<label class="btn btn-s" style="font-size:10px;padding:4px 10px;cursor:pointer;position:relative;overflow:hidden">上传视频<input type="file" accept="video/*" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer" onchange="uploadLessonVideo(this,\'' + cid + '\',\'' + l.id + '\')"></label>' +
        '</div>';
      } else {
        h += '<textarea data-lid="' + l.id + '" data-cid="' + cid + '" data-field="content" placeholder="图文内容（支持HTML）" style="width:100%;min-height:120px;padding:8px;border:1px solid #e4e9f0;border-radius:4px;font-size:13px;line-height:1.6" onblur="updLesson(this)">' + esc(l.content||'') + '</textarea>';
      }
      h += '</div>';
    });
    h += '<div style="margin-top:12px;border-top:1px solid #f0f2f5;padding-top:12px">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px">添加新课时</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
        '<select id="nl-type-' + cid + '" style="padding:6px;border:1px solid #e4e9f0;border-radius:4px" onchange="toggleLessonType(\'' + cid + '\')"><option value="video">视频课时</option><option value="article">图文课时</option></select>' +
        '<input id="nl-title-' + cid + '" placeholder="课时标题" style="flex:1;min-width:120px;padding:6px;border:1px solid #e4e9f0;border-radius:4px">' +
      '</div>' +
      '<div id="nl-video-' + cid + '" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        '<input id="nl-url-' + cid + '" placeholder="视频URL（可直接粘贴，或点右侧上传）" style="flex:1;min-width:200px;padding:6px;border:1px solid #e4e9f0;border-radius:4px;font-size:12px">' +
        '<input id="nl-dur-' + cid + '" type="number" placeholder="时长(秒)" style="width:80px;padding:6px;border:1px solid #e4e9f0;border-radius:4px">' +
        '<label class="btn btn-s" style="font-size:11px;padding:6px 12px;cursor:pointer;position:relative;overflow:hidden">上传视频<input type="file" accept="video/*" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer" onchange="uploadNewLessonVideo(this,\'' + cid + '\')"></label>' +
      '</div>' +
      '<div id="nl-article-' + cid + '" style="display:none;margin-bottom:8px">' +
        '<textarea id="nl-content-' + cid + '" placeholder="图文内容（支持HTML）" style="width:100%;min-height:100px;padding:8px;border:1px solid #e4e9f0;border-radius:4px;font-size:13px;line-height:1.6"></textarea>' +
      '</div>' +
      '<button class="btn btn-p" onclick="addLesson(\'' + cid + '\')">添加课时</button>' +
    '</div>';
    document.getElementById('lessons-' + cid).innerHTML = h;
  });
}

function toggleLessonType(cid) {
  var sel = document.getElementById('nl-type-' + cid);
  if (!sel) return;
  var v = sel.value;
  document.getElementById('nl-video-' + cid).style.display = v === 'video' ? 'flex' : 'none';
  document.getElementById('nl-article-' + cid).style.display = v === 'article' ? 'block' : 'none';
}

function updLesson(inp) {
  var lid = inp.dataset.lid, cid = inp.dataset.cid, field = inp.dataset.field, v = inp.value;
  if (field === 'duration') v = parseInt(v) || 0;
  api(B + '/api/training/courses/' + cid + '/lessons/' + lid, {method: 'PUT', body: {[field]: v}});
}

function uploadLessonVideo(input, cid, lid) {
  var file = input.files[0];
  if (!file) return;
  var btn = input.parentElement;
  var oldText = btn.textContent;
  btn.textContent = '上传中...';
  btn.style.opacity = '0.6';
  var formData = new FormData();
  formData.append('file', file);
  fetch(B + '/api/upload/video', {method: 'POST', body: formData})
    .then(function(r) { return r.json(); })
    .then(function(res) {
      btn.textContent = oldText;
      btn.style.opacity = '1';
      if (res.code === 0) {
        var fullUrl = ORIGIN + res.data.url;
        var urlInput = document.querySelector('[data-lid="' + lid + '"][data-field="videoUrl"]');
        if (urlInput) { urlInput.value = fullUrl; updLesson(urlInput); }
        alert('视频上传成功！文件大小：' + Math.round(res.data.size/1024) + 'KB');
      } else { alert('上传失败：' + (res.message || '未知错误')); }
    })
    .catch(function(err) { btn.textContent = oldText; btn.style.opacity = '1'; alert('上传失败：' + err.message); });
}

function uploadNewLessonVideo(input, cid) {
  var file = input.files[0];
  if (!file) return;
  var btn = input.parentElement;
  var oldText = btn.textContent;
  btn.textContent = '上传中...';
  btn.style.opacity = '0.6';
  var formData = new FormData();
  formData.append('file', file);
  fetch(B + '/api/upload/video', {method: 'POST', body: formData})
    .then(function(r) { return r.json(); })
    .then(function(res) {
      btn.textContent = oldText;
      btn.style.opacity = '1';
      if (res.code === 0) {
        var fullUrl = ORIGIN + res.data.url;
        document.getElementById('nl-url-' + cid).value = fullUrl;
        alert('视频上传成功！文件大小：' + Math.round(res.data.size/1024) + 'KB\nURL已自动填入，点"添加课时"即可保存。');
      } else { alert('上传失败：' + (res.message || '未知错误')); }
    })
    .catch(function(err) { btn.textContent = oldText; btn.style.opacity = '1'; alert('上传失败：' + err.message); });
}

function addLesson(cid) {
  var typeSel = document.getElementById('nl-type-' + cid);
  var type = typeSel ? typeSel.value : 'video';
  var t = val('nl-title-' + cid);
  if (!t) { alert('请填写课时标题'); return; }
  var body = {title: t, type: type};
  if (type === 'video') {
    var u = val('nl-url-' + cid);
    if (!u) { alert('请填写视频URL'); return; }
    body.videoUrl = u;
    body.duration = parseInt(val('nl-dur-' + cid)) || 0;
  } else {
    var c = val('nl-content-' + cid);
    if (!c) { alert('请填写图文内容'); return; }
    body.content = c;
  }
  api(B + '/api/training/courses/' + cid + '/lessons', {method: 'POST', body: body}).then(function() { loadLessons(cid); });
}

function delLesson(cid, lid) {
  if (!confirm('确认删除课时？')) return;
  api(B + '/api/training/courses/' + cid + '/lessons/' + lid, {method: 'DELETE'}).then(function() { loadLessons(cid); });
}

function createCourse() {
  var title = val('ct');
  if (!title) { alert('请输入课程标题'); return; }
  api(B + '/api/training/courses', {method: 'POST', body: {
    title: title, description: val('cd'), category: val('cc'), coverImage: ''
  }}).then(function(r) {
    if (r.code === 0) { val('ct', ''); val('cd', ''); loadCourses(); }
    else { alert(r.message || '创建失败'); }
  }).catch(function(e) { alert('网络错误: ' + e); });
}

// ===== 题目 =====
var oc = 4;
function renderOpts() {
  var t = val('qt');
  var n = t === 'judge' ? 2 : oc;
  var h = '';
  for (var i = 0; i < n; i++) {
    var lb = String.fromCharCode(65 + i);
    var ph = t === 'judge' ? (i === 0 ? '正确' : '错误') : '选项' + lb;
    h += '<div class="opt"><input type="checkbox" data-idx="' + i + '"><input type="text" placeholder="' + ph + '" data-oi="' + i + '"></div>';
  }
  document.getElementById('qopts').innerHTML = h;
  if (t === 'judge') {
    document.querySelector('[data-oi="0"]').value = '正确';
    document.querySelector('[data-oi="1"]').value = '错误';
  }
}
function addOpt() { oc++; renderOpts(); }

function loadQ() {
  api(B + '/api/exam/questions').then(function(r) {
    allQuestions = r.data || [];
    // 更新分类筛选下拉
    var cats = {};
    allQuestions.forEach(function(q) { var c = q.category || '未分类'; cats[c] = true; });
    var fh = '<option value="">全部分类</option>';
    Object.keys(cats).forEach(function(c) { fh += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    document.getElementById('qfilter').innerHTML = fh;
    // 同步考试管理页的筛选下拉
    if (document.getElementById('epickfilter')) {
      document.getElementById('epickfilter').innerHTML = fh;
    }
    // 渲染题库列表
    var filter = document.getElementById('qfilter') ? document.getElementById('qfilter').value : '';
    var h = '';
    var qs = allQuestions;
    if (filter) qs = qs.filter(function(q) { return (q.category || '未分类') === filter; });
    if (qs.length === 0) h = '<div class="empty">暂无题目，可在上方创建或用AI生成</div>';
    qs.forEach(function(q) {
      var tn = q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断';
      var tc = q.type === 'single' ? 't-single' : q.type === 'multiple' ? 't-multiple' : 't-judge';
      var oh = '';
      q.options.forEach(function(o, oi) {
        var ic = q.answer.indexOf(oi) >= 0;
        var lb = String.fromCharCode(65 + oi);
        oh += '<div class="opt ' + (ic ? 'opt-correct' : 'opt-wrong') + '">' +
          '<input type="checkbox" data-qid="' + q.id + '" data-oidx="' + oi + '" ' + (ic ? 'checked' : '') + ' onchange="toggleAnswer(this)">' +
          '<input type="text" value="' + esc(o) + '" data-qid="' + q.id + '" data-oidx="' + oi + '" data-field="option" onblur="updOpt(this)" style="flex:1">' +
          '<span style="font-size:11px;color:' + (ic ? '#00b578' : '#8a95a7') + '">' + lb + '</span>' +
        '</div>';
      });
      var eh = q.explanation ? '<div class="exp">💡 ' + esc(q.explanation) + '</div>' : '';
      h += '<div class="qc">' +
        '<div class="qc-head">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span class="tag ' + tc + '">' + tn + '</span>' +
            '<input type="number" value="' + q.score + '" data-qid="' + q.id + '" data-field="score" style="width:50px;padding:4px;border:1px solid #e4e9f0;border-radius:4px" onblur="updQField(this)"><span style="font-size:12px;color:#8a95a7">分</span>' +
            '<input type="text" value="' + esc(q.category) + '" data-qid="' + q.id + '" data-field="category" style="width:80px;padding:4px 6px;border:1px solid #e4e9f0;border-radius:4px;font-size:12px" onblur="updQField(this)">' +
          '</div>' +
          '<button class="btn btn-d" style="font-size:11px;padding:3px 10px" onclick="delQ(\'' + q.id + '\')">删除</button>' +
        '</div>' +
        '<textarea data-qid="' + q.id + '" data-field="content" style="width:100%;font-size:15px;font-weight:500;border:1px solid transparent;border-radius:4px;padding:8px;margin-bottom:8px" rows="2" onblur="updQField(this)">' + esc(q.content) + '</textarea>' +
        '<div>' + oh + '</div>' +
        '<textarea data-qid="' + q.id + '" data-field="explanation" placeholder="解析" style="width:100%;border:1px solid #f0f2f5;border-radius:4px;padding:6px;font-size:12px;margin-top:6px" rows="1" onblur="updQField(this)">' + esc(q.explanation||'') + '</textarea>' +
      '</div>';
    });
    document.getElementById('qlist').innerHTML = h;
  });
}

function toggleAnswer(cb) {
  var qid = cb.dataset.qid;
  api(B + '/api/exam/questions').then(function(r) {
    var q = (r.data||[]).find(function(x) { return x.id == qid; });
    if (!q) return;
    var ans = [];
    document.querySelectorAll('[data-qid="' + qid + '"][data-oidx]').forEach(function(c) {
      if (c.checked) ans.push(parseInt(c.dataset.oidx));
    });
    api(B + '/api/exam/questions/' + qid + '/update', {method: 'POST', body: {answer: ans}});
  });
}
function updOpt(inp) {
  var qid = inp.dataset.qid, oi = parseInt(inp.dataset.oidx);
  api(B + '/api/exam/questions').then(function(r) {
    var q = (r.data||[]).find(function(x) { return x.id == qid; });
    if (!q) return;
    var opts = q.options.slice();
    opts[oi] = inp.value;
    api(B + '/api/exam/questions/' + qid + '/update', {method: 'POST', body: {options: opts}});
  });
}
function updQField(inp) {
  var qid = inp.dataset.qid, field = inp.dataset.field, v = inp.value;
  if (field === 'score') v = parseInt(v) || 1;
  api(B + '/api/exam/questions/' + qid + '/update', {method: 'POST', body: {[field]: v}});
}
function delQ(id) { if (!confirm('确认删除？')) return; api(B + '/api/exam/questions/' + id, {method: 'DELETE'}).then(function() { loadQ(); }); }
function createQ() {
  var t = val('qt');
  var opts = [], ans = [];
  document.querySelectorAll('#qopts input[data-oi]').forEach(function(i) { opts.push(i.value); });
  document.querySelectorAll('#qopts input[type=checkbox]').forEach(function(c) { if (c.checked) ans.push(parseInt(c.dataset.idx)); });
  api(B + '/api/exam/questions', {method: 'POST', body: {
    type: t, content: val('qct'), options: opts, answer: ans,
    score: parseInt(val('qs')), explanation: val('qe'), category: val('qc2')
  }}).then(function() { loadQ(); val('qct',''); val('qe',''); });
}

// ===== AI =====
function aiGen() {
  var t = val('ait');
  if (!t) { alert('请输入主题'); return; }
  var b = document.getElementById('aibtn'), s = document.getElementById('aist');
  b.disabled = true; b.textContent = '🤖 生成中...';
  s.textContent = 'AI正在生成，请稍候...';
  api(B + '/api/exam/generate', {method: 'POST', body: {topic: t, count: parseInt(val('aic'))}}).then(function(r) {
    b.disabled = false; b.textContent = '🤖 AI生成';
    if (r.code === 0) { s.textContent = '✅ 生成' + r.data.length + '道题目'; s.style.color = '#00b578'; loadQ(); val('ait',''); }
    else { s.textContent = '❌ ' + r.message; s.style.color = '#f79009'; }
  }).catch(function() { b.disabled = false; b.textContent = '🤖 AI生成'; s.textContent = '❌ 网络错误'; s.style.color = '#f79009'; });
}

// ===== 考试 =====
function loadPick() {
  api(B + '/api/exam/questions').then(function(r) {
    allQuestions = r.data || [];
    // 同步分类筛选下拉
    var cats = {};
    allQuestions.forEach(function(q) { var c = q.category || '未分类'; cats[c] = true; });
    var fh = '<option value="">全部分类</option>';
    Object.keys(cats).forEach(function(c) { fh += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    document.getElementById('epickfilter').innerHTML = fh;
    renderPick();
  });
}

function renderPick() {
  var filter = document.getElementById('epickfilter') ? document.getElementById('epickfilter').value : '';
  var qs = allQuestions;
  if (filter) qs = qs.filter(function(q) { return (q.category || '未分类') === filter; });
  var h = '';
  if (qs.length === 0) h = '<div class="empty">请先创建题目</div>';
  qs.forEach(function(q) {
    var tn = q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断';
    var cat = q.category || '未分类';
    h += '<div class="opt"><input type="checkbox" data-qid="' + q.id + '" onchange="updatePickCount()"><span class="tag t-' + q.type + '">' + tn + '</span><span style="font-size:12px;color:#8a95a7">[' + esc(cat) + ']</span><span style="font-size:13px;flex:1">' + esc(q.content) + '</span><span style="font-size:11px;color:#8a95a7">' + q.score + '分</span></div>';
  });
  document.getElementById('epick').innerHTML = h;
  updatePickCount();
}

function updatePickCount() {
  var count = 0;
  document.querySelectorAll('#epick input[data-qid]').forEach(function(c) { if (c.checked) count++; });
  var el = document.getElementById('pickcount');
  if (el) el.textContent = count;
}

function loadExams() {
  api(B + '/api/exam/list').then(function(r) {
    var h = '';
    (r.data||[]).forEach(function(e) {
      var st = e.status === 'published' ? '<span style="background:#e8f8f0;color:#00b578;padding:2px 8px;border-radius:4px;font-size:11px">已发布</span>' : '<span style="background:#f0f2f5;color:#8a95a7;padding:2px 8px;border-radius:4px;font-size:11px">草稿</span>';
      var pb = e.status === 'draft' ? '<button class="btn btn-s" style="font-size:11px;padding:3px 10px" onclick="pub(\'' + e.id + '\')">发布</button>' : '';
      h += '<div class="qc-head" style="border-bottom:1px solid #f8f9fa;padding:12px 0"><div><div style="font-size:15px;font-weight:500">' + esc(e.title) + '</div><div style="font-size:12px;color:#8a95a7;margin-top:4px">题目:' + e.questionIds.length + ' | 时长:' + e.duration + '分钟 | 及格:' + e.passScore + '分</div></div><div style="display:flex;gap:6px;align-items:center">' + st + pb + '</div></div>';
    });
    document.getElementById('elist').innerHTML = h || '<div class="empty">暂无考试</div>';
  });
}
function createExam() {
  var ids = [];
  document.querySelectorAll('#epick input[data-qid]').forEach(function(c) { if (c.checked) ids.push(c.dataset.qid); });
  if (ids.length === 0) { alert('请至少选一道题'); return; }
  api(B + '/api/exam/create', {method: 'POST', body: {
    title: val('et'), duration: parseInt(val('ed')), passScore: parseInt(val('ep')), questionIds: ids
  }}).then(function() { loadExams(); val('et',''); document.querySelectorAll('#epick input[data-qid]').forEach(function(c) { c.checked = false; }); updatePickCount(); });
}
function pub(id) { api(B + '/api/exam/' + id + '/publish', {method: 'POST'}).then(function() { loadExams(); }); }

// 初始化
renderOpts();
loadCourses();
</script>
</body></html>`;
