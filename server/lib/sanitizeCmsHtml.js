/**
 * Server-side guard for CMS HTML (page heroes). Strips scripts, event handlers,
 * dangerous tags, and javascript: URLs so stored JSON cannot bypass the front-end sanitizer.
 */

const UNSAFE_TAG_RE = /<\/?(?:script|style|iframe|object|embed|svg|math|link|meta|base|form)\b[^>]*>/gi;
const EVENT_HANDLER_RE = /\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTR_RE = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF_RE = /\shref\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

function sanitizeCmsHtmlFragment(input) {
  if (input == null) return '';
  let s = String(input);
  s = s.replace(UNSAFE_TAG_RE, '');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  s = s.replace(EVENT_HANDLER_RE, '');
  s = s.replace(STYLE_ATTR_RE, '');
  s = s.replace(JS_HREF_RE, '');
  return s;
}

/** Sanitize known HTML string fields on a pageCopy patch object. */
function sanitizePageCopyPatch(patch) {
  if (!patch || typeof patch !== 'object') return patch;
  const out = { ...patch };
  for (const k of ['secTag', 'titleHtml', 'leadHtml']) {
    if (typeof out[k] === 'string') {
      out[k] = sanitizeCmsHtmlFragment(out[k]);
    }
  }
  return out;
}

module.exports = { sanitizeCmsHtmlFragment, sanitizePageCopyPatch };
