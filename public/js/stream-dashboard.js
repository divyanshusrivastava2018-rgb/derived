/**
 * Stream Studio dashboard — preview, mock chat, OBS helpers.
 * No inline handlers (CSP-safe on Node server).
 */
(function () {
  const CHANNEL_ID = 'UCu4B2QfpHl7aLoVEZWwEw5g';
  const RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';

  let isLive = false;
  let timerInterval = null;
  let seconds = 0;
  let viewerInterval = null;
  let viewers = 0;
  let chatIdx = 0;

  const chatMessages = [
    { user: 'Rahul Sharma', text: 'Sir please explain eigenvalues again' },
    { user: 'Priya Singh', text: 'Can you solve question 5 from last paper?' },
    { user: 'Amit Kumar', text: 'Thanks sir! Very clear explanation' },
    { user: 'Neha Patel', text: 'Sir audio is little low please increase' },
    { user: 'Rohan Verma', text: 'Sir when is next class on topology?' },
    { user: 'Deepika', text: 'Great class! Subscribed' }
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function appendChatMessage(user, text, isYou) {
    const area = el('chatArea');
    const empty = el('chatEmpty');
    if (empty) {
      empty.remove();
    }
    const now = new Date();
    const timeStr =
      now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const userClass = isYou ? 'chat-user chat-user--you' : 'chat-user';
    const userLabel = isYou ? 'You (Teacher)' : escapeHtml(user);
    div.innerHTML =
      '<div class="chat-meta"><span class="' +
      userClass +
      '">' +
      userLabel +
      '</span><span class="chat-time">' +
      timeStr +
      '</span></div><div class="chat-text">' +
      escapeHtml(text) +
      '</div>';
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  function simulateChat() {
    if (!isLive) {
      return;
    }
    const msg = chatMessages[chatIdx % chatMessages.length];
    chatIdx += 1;
    appendChatMessage(msg.user, msg.text, false);
    setTimeout(simulateChat, Math.random() * 6000 + 3000);
  }

  function updateTimer() {
    seconds += 1;
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el('duration').textContent = h + ':' + m + ':' + s;
  }

  function toggleLive() {
    isLive = !isLive;
    const btn = el('goLiveBtn');
    const dot = el('statusDot');
    const label = el('statusLabel');
    const badge = el('liveBadge');
    const offline = el('previewOffline');
    const frame = el('liveFrame');
    const bitrate = el('bitrate');

    if (isLive) {
      btn.className = 'btn btn-danger';
      btn.innerHTML = '&#9632; End stream';
      dot.className = 'status-dot live';
      label.className = 'status-label live';
      label.textContent = 'LIVE';
      badge.style.display = 'block';
      offline.style.display = 'none';
      frame.style.display = 'block';
      frame.src =
        'https://www.youtube.com/embed/live_stream?channel=' +
        CHANNEL_ID +
        '&autoplay=1';
      bitrate.textContent = '4500 kbps';
      seconds = 0;
      timerInterval = setInterval(updateTimer, 1000);
      viewers = Math.floor(Math.random() * 15) + 3;
      el('viewerCount').textContent = String(viewers);
      viewerInterval = setInterval(function () {
        viewers += Math.floor(Math.random() * 3) - 1;
        if (viewers < 0) {
          viewers = 0;
        }
        el('viewerCount').textContent = String(viewers);
      }, 8000);
      simulateChat();
    } else {
      btn.className = 'btn btn-primary';
      btn.innerHTML = '&#9679; Go live';
      dot.className = 'status-dot offline';
      label.className = 'status-label offline';
      label.textContent = 'Offline';
      badge.style.display = 'none';
      offline.style.display = 'flex';
      frame.style.display = 'none';
      frame.src = '';
      bitrate.textContent = '— kbps';
      el('viewerCount').textContent = '0';
      clearInterval(timerInterval);
      clearInterval(viewerInterval);
    }
  }

  function sendChat() {
    const input = el('chatInput');
    const text = input.value.trim();
    if (!text) {
      return;
    }
    appendChatMessage('', text, true);
    input.value = '';
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).catch(function () {});
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () {
      btn.textContent = orig;
    }, 1800);
  }

  function copyStreamKey() {
    window.alert(
      'Open YouTube Studio → Go Live → Stream settings to copy your stream key. Never paste it in public pages.'
    );
  }

  function revealKey(btn) {
    const keyEl = el('streamKeyDisplay');
    if (btn.textContent === 'Show') {
      keyEl.textContent = 'Paste from YouTube Studio (not stored here)';
      btn.textContent = 'Hide';
    } else {
      keyEl.textContent = '••••-••••-••••-••••';
      btn.textContent = 'Show';
    }
  }

  function copyPageLink() {
    const studentUrl = window.location.origin + '/live-classes.html';
    navigator.clipboard.writeText(studentUrl).catch(function () {});
    window.alert('Student link copied:\n\n' + studentUrl);
  }

  function openSchedule() {
    window.alert(
      'Schedule editing coming soon. For now, update items in stream-dashboard.html or connect your live schedule API.'
    );
  }

  function bindUi() {
    el('goLiveBtn').addEventListener('click', toggleLive);
    el('btnSchedule').addEventListener('click', openSchedule);
    el('btnStreamKeyHelp').addEventListener('click', copyStreamKey);
    el('btnShareStudentLink').addEventListener('click', copyPageLink);
    el('btnSendChat').addEventListener('click', sendChat);
    el('btnCopyRtmp').addEventListener('click', function () {
      copyText(RTMP_URL, el('btnCopyRtmp'));
    });
    el('btnRevealKey').addEventListener('click', function () {
      revealKey(el('btnRevealKey'));
    });
    el('chatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        sendChat();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }
})();
