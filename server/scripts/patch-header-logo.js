#!/usr/bin/env node
/**
 * Ensure header mount shows logo image immediately; load chrome right after header.
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../../public");
const LOGO_VER = "header6";
const FALLBACK =
  '<header id="site-header" class="site-header-mount">' +
  '<a href="/" class="site-nav__brand site-nav__brand--preload" aria-label="Researchium home">' +
  '<img src="/images/researchium-logo.png?v=' +
  LOGO_VER +
  '" alt="Researchium" class="site-nav__logo-img" width="1024" height="210" decoding="async" fetchpriority="high" />' +
  "</a></header>";
const CHROME_SYNC = '<script src="/js/researchium-chrome.js"></script>';
const EMPTY_MOUNT = /<header id="site-header" class="site-header-mount"><\/header>/g;
const DEFER_CHROME = /\s*<script defer src="\/js\/researchium-chrome\.js"><\/script>/g;
const OLD_PRELOAD =
  /<header id="site-header" class="site-header-mount">[\s\S]*?<\/header>/g;

let changed = 0;

for (const name of fs.readdirSync(publicDir)) {
  if (!name.endsWith(".html")) continue;
  const file = path.join(publicDir, name);
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  if (!html.includes('id="site-header"')) continue;

  if (html.includes("site-nav__brand--preload")) {
    html = html.replace(OLD_PRELOAD, FALLBACK);
  } else {
    html = html.replace(EMPTY_MOUNT, FALLBACK + "\n    " + CHROME_SYNC);
  }
  html = html.replace(DEFER_CHROME, "");
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
    console.log("updated:", name);
  }
}

console.log("Done. Files changed:", changed);
