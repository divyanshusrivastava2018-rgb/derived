/** Shared Content-Security-Policy for static studio pages. */
(function (global) {
  if (global.ResearchiumStudioEnv) {
    global.ResearchiumStudioEnv.configure();
  }
  const extra =
    global.location.pathname && global.location.pathname.includes('studio.html')
      ? []
      : [];
  global.ResearchiumCspMeta = global.ResearchiumStudioEnv
    ? global.ResearchiumStudioEnv.buildCsp({ extraScriptSrc: extra })
    : "default-src 'self'; script-src 'self'; connect-src 'self'";
})(window);
