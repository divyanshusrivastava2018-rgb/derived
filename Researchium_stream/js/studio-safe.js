/**
 * Safe text for DOM (XSS mitigation).
 */
window.ResearchiumSafe = (function () {
  function escapeHtml(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function appendChatMessage(parent, authorName, body) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const strong = document.createElement('strong');
    strong.textContent = authorName || 'Guest';
    div.appendChild(strong);
    div.appendChild(document.createTextNode(body || ''));
    parent.appendChild(div);
    return div;
  }

  return { escapeHtml, appendChatMessage };
})();
