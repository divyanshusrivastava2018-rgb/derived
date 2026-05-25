/**
 * Decode obfuscated GATE answer keys (must match server/lib/gateBundleCodec.js).
 */
(function () {
  "use strict";

  var PEPPER = "researchium-gate-bundle-v1";

  function paperKeyBytes(slug) {
    var s = PEPPER + ":" + String(slug);
    var out = new Uint8Array(32);
    for (var i = 0; i < 32; i += 1) {
      out[i] = s.charCodeAt(i % s.length) ^ ((i * 31) & 255);
    }
    return out;
  }

  function base64UrlToBytes(b64) {
    var pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    var std = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
    var bin = atob(std);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  function decodeAnswers(slug, enc) {
    if (!enc) return {};
    try {
      var buf = base64UrlToBytes(enc);
      var key = paperKeyBytes(slug);
      for (var i = 0; i < buf.length; i += 1) {
        buf[i] ^= key[i % key.length];
      }
      var text = new TextDecoder().decode(buf);
      var entries = JSON.parse(text);
      if (!Array.isArray(entries)) return {};
      var out = {};
      entries.forEach(function (pair) {
        if (pair && pair.length >= 2) {
          out[String(pair[0])] = Number(pair[1]);
        }
      });
      return out;
    } catch {
      return {};
    }
  }

  window.GateBundleDecode = {
    decodeAnswers: decodeAnswers
  };
})();
