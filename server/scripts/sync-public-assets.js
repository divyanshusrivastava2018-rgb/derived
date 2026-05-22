#!/usr/bin/env node
/**
 * One-time sync: point all public HTML at researchium-core + researchium-chrome.
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../../public");
const CORE = '<script defer src="/js/researchium-core.js"></script>';
const CHROME = '<script defer src="/js/researchium-chrome.js"></script>';
const LEGACY_CORE =
  /<script defer src="\/js\/api-client\.js"><\/script>\s*<script defer src="\/js\/site-data\.js"><\/script>/g;
const LEGACY_CORE_INLINE =
  /<script defer src="\/js\/api-client\.js"><\/script><script defer src="\/js\/site-data\.js"><\/script>/g;
const LEGACY_API_ONLY = /<script defer src="\/js\/api-client\.js"><\/script>/g;
const LEGACY_SHELL = /<script defer src="\/js\/site-shell\.js"><\/script>/g;
const LEGACY_SITE_DATA = /<script defer src="\/js\/site-data\.js"><\/script>\s*/g;
const EDUTHINK_CSS = /\s*<link[^>]*href="\/css\/eduthink-layout\.css"[^>]*\/?>\s*/g;
const SITE_NAV_EXTRA = /\s*<link[^>]*href="\/css\/site-nav\.css"[^>]*\/?>\s*/g;

let changed = 0;

for (const name of fs.readdirSync(publicDir)) {
  if (!name.endsWith(".html")) continue;
  const file = path.join(publicDir, name);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  html = html.replace(EDUTHINK_CSS, "\n");
  html = html.replace(SITE_NAV_EXTRA, "\n");
  html = html.replace(LEGACY_CORE, CORE + "\n    ");
  html = html.replace(LEGACY_CORE_INLINE, CORE);
  html = html.replace(LEGACY_API_ONLY, CORE);
  html = html.replace(LEGACY_SHELL, CHROME);
  html = html.replace(LEGACY_SITE_DATA, "");

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
    console.log("updated:", name);
  }
}

console.log("Done. Files changed:", changed);
