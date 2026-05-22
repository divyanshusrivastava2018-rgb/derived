/**
 * Researchium admin dashboard UI — charts, stats, notifications (light theme).
 * Expects GET /api/admin/dashboard (authenticated).
 */
(function (global) {
  var CHART_COLORS = ['#6d28d9', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0d9488', '#2563eb', '#64748b'];
  var charts = { enroll: null, donut: null };

  function fmtNum(n) {
    if (n == null || Number.isNaN(n)) return '—';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderStats(stats) {
    var map = [
      ['admStatLearners', stats.learners, 'ti-users'],
      ['admStatCourses', stats.courses, 'ti-book'],
      ['admStatLeads', stats.contactLeads, 'ti-mail'],
      ['admStatSignups', stats.emailSignups, 'ti-user-plus']
    ];
    map.forEach(function (row) {
      var el = document.getElementById(row[0]);
      if (el) el.textContent = fmtNum(row[1]);
    });
    setText('admStatLeadsDelta', '+' + (stats.newLeadsWeek || 0) + ' this week');
    setText('admStatBlog', String(stats.blogPosts || 0));
    setText('admStatNews', String(stats.newsItems || 0));
    setText('admStatMaterials', String(stats.materials || 0));

    var badge = document.getElementById('admLeadsBadge');
    if (badge) {
      var n = stats.newLeadsWeek || 0;
      badge.textContent = n > 0 ? String(n) : '';
      badge.hidden = n <= 0;
    }
  }

  function renderRecentLeads(rows) {
    var tbody = document.getElementById('admRecentLeadsBody');
    if (!tbody) return;
    if (!rows || !rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="adm-empty">No contact messages yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr><td>' +
          escapeHtml(r.name) +
          '</td><td>' +
          escapeHtml(r.subject) +
          '</td><td>' +
          escapeHtml(r.date) +
          '</td><td><span class="adm-badge adm-b-blue">New</span></td></tr>'
        );
      })
      .join('');
  }

  function renderActivity(items) {
    var root = document.getElementById('admActivityFeed');
    if (!root) return;
    if (!items || !items.length) {
      root.innerHTML = '<p class="adm-empty">No recent activity.</p>';
      return;
    }
    root.innerHTML = items
      .map(function (a) {
        var tone = 'adm-si-' + (a.tone || 'blue');
        return (
          '<div class="adm-activity-item">' +
          '<div class="adm-activity-icon ' +
          tone +
          '"><i class="ti ' +
          escapeHtml(a.icon || 'ti-bell') +
          '"></i></div>' +
          '<div><div class="adm-activity-text">' +
          escapeHtml(a.text) +
          '</div>' +
          '<div class="adm-activity-time">' +
          escapeHtml(a.time || '') +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function renderTopCourses(courses) {
    var root = document.getElementById('admTopCourses');
    if (!root) return;
    if (!courses || !courses.length) {
      root.innerHTML = '<p class="adm-empty">No courses in catalog.</p>';
      return;
    }
    root.innerHTML = courses
      .map(function (c) {
        var price = Number(c.price) > 0 ? '₹' + c.price : 'Free';
        return (
          '<div class="adm-course-pill"><strong>' +
          escapeHtml(c.title) +
          '</strong><span>' +
          escapeHtml(c.category) +
          ' · ' +
          fmtNum(c.students) +
          ' learners · ' +
          price +
          '</span></div>'
        );
      })
      .join('');
  }

  function renderDonutLegend(categories) {
    var root = document.getElementById('admDonutLegend');
    if (!root) return;
    if (!categories || !categories.length) {
      root.innerHTML = '<p class="adm-empty">No categories yet.</p>';
      return;
    }
    root.innerHTML = categories
      .map(function (c, i) {
        var color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          '<div class="adm-legend-row">' +
          '<div class="adm-legend-dot" style="background:' +
          color +
          '"></div>' +
          '<span>' +
          escapeHtml(c.label) +
          '</span>' +
          '<span class="adm-legend-val">' +
          c.count +
          '</span></div>'
        );
      })
      .join('');
  }

  function renderNotifications(data) {
    var panel = document.getElementById('admNotifList');
    if (!panel) return;
    var items = [];
    (data.recentLeads || []).slice(0, 2).forEach(function (l) {
      items.push({
        icon: 'ti-mail',
        tone: 'adm-si-green',
        text: 'New contact from <strong>' + escapeHtml(l.name) + '</strong>',
        time: l.date
      });
    });
    (data.recentSignups || []).slice(0, 2).forEach(function (s) {
      items.push({
        icon: 'ti-user-plus',
        tone: 'adm-si-blue',
        text: 'Signup: ' + escapeHtml(s.email),
        time: s.date
      });
    });
    if (!items.length) {
      panel.innerHTML = '<div class="adm-notif-item"><span class="adm-empty">No new notifications</span></div>';
      return;
    }
    panel.innerHTML = items
      .map(function (n) {
        return (
          '<div class="adm-notif-item">' +
          '<div class="adm-activity-icon ' +
          n.tone +
          '"><i class="ti ' +
          n.icon +
          '"></i></div>' +
          '<div><div>' +
          n.text +
          '</div><div class="adm-activity-time">' +
          escapeHtml(n.time) +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function chartDefaults() {
    if (!global.Chart) return;
    Chart.defaults.color = '#718096';
    Chart.defaults.borderColor = '#e2e8f0';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.font.size = 11;
  }

  function initEnrollChart(trend, type) {
    var canvas = document.getElementById('admEnrollChart');
    if (!canvas || !global.Chart) return;
    chartDefaults();
    var labels = (trend || []).map(function (t) {
      return t.label;
    });
    var values = (trend || []).map(function (t) {
      return t.count;
    });
    if (charts.enroll) charts.enroll.destroy();
    charts.enroll = new Chart(canvas, {
      type: type || 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Activity',
            data: values,
            backgroundColor: 'rgba(109, 40, 217, 0.25)',
            borderColor: '#6d28d9',
            borderWidth: 1.5,
            borderRadius: 4,
            fill: type === 'line',
            tension: 0.35,
            pointBackgroundColor: '#6d28d9',
            pointRadius: type === 'line' ? 4 : 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#edf2f7' }, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  function initDonutChart(categories) {
    var canvas = document.getElementById('admDonutChart');
    if (!canvas || !global.Chart) return;
    chartDefaults();
    var data = (categories || []).map(function (c) {
      return c.count;
    });
    if (charts.donut) charts.donut.destroy();
    if (!data.length) return;
    charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: data,
            backgroundColor: data.map(function (_, i) {
              return CHART_COLORS[i % CHART_COLORS.length];
            }),
            borderWidth: 0,
            hoverOffset: 4
          }
        ]
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(data) {
    if (!data) return;
    var stats = data.stats || {};
    renderStats(stats);
    renderRecentLeads(data.recentLeads);
    renderActivity(data.activity);
    renderTopCourses(data.topCourses);
    renderDonutLegend(data.courseCategories);
    renderNotifications(data);

    var sub = document.getElementById('admOverviewSub');
    if (sub) {
      var when = data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-IN') : 'just now';
      sub.textContent =
        'Welcome back · ' + (data.siteUrl || 'derived.co.in') + ' · Updated ' + when;
    }

    initEnrollChart(data.enrollmentTrend, 'bar');
    initDonutChart(data.courseCategories);
  }

  function switchEnrollChart(btn, type) {
    document.querySelectorAll('[data-enroll-chart]').forEach(function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    var canvas = document.getElementById('admEnrollChart');
    if (!canvas || !charts.enroll) return;
    charts.enroll.config.type = type;
    if (type === 'line') {
      charts.enroll.data.datasets[0].fill = true;
      charts.enroll.data.datasets[0].pointRadius = 4;
    } else {
      charts.enroll.data.datasets[0].fill = false;
      charts.enroll.data.datasets[0].pointRadius = 0;
    }
    charts.enroll.update();
  }

  function bindChrome() {
    var sidebar = document.getElementById('admSidebar');
    var toggle = document.getElementById('admSidebarToggle');
    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        if (window.innerWidth < 768) sidebar.classList.toggle('is-open');
        else sidebar.classList.toggle('is-collapsed');
      });
    }

    var notifBtn = document.getElementById('admNotifBtn');
    var notifPanel = document.getElementById('admNotifPanel');
    if (notifBtn && notifPanel) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        notifPanel.classList.toggle('is-open');
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#admNotifBtn') && !e.target.closest('#admNotifPanel')) {
          notifPanel.classList.remove('is-open');
        }
      });
    }

    document.querySelectorAll('[data-enroll-chart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchEnrollChart(btn, btn.getAttribute('data-enroll-chart'));
      });
    });

    var newCourse = document.getElementById('admNewCourseBtn');
    if (newCourse) {
      newCourse.addEventListener('click', function () {
        var nav = document.querySelector('.adm-nav-item[data-tab="videos"]');
        if (nav) nav.click();
      });
    }
  }

  bindChrome();

  global.AdminDashboard = {
    render: render,
    refresh: function (fetchFn) {
      return fetchFn('/api/admin/dashboard', { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('dashboard');
          return r.json();
        })
        .then(render);
    }
  };
})(window);
