(function () {
  var root = document.getElementById("blog-list-root");
  if (!root) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function safeHref(u) {
    u = String(u || "/").trim();
    if (u.startsWith("/")) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return "/";
  }

  fetch("/api/blog")
    .then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(function (posts) {
      if (!posts.length) {
        root.innerHTML = '<p class="loading-banner">No posts yet. Add some in the Admin panel.</p>';
        return;
      }
      root.innerHTML = posts
        .map(function (p) {
          return (
            '<a href="' +
            esc(safeHref(p.href)) +
            '" class="blog-card">' +
            '<div class="blog-tag">' +
            esc(p.tag) +
            "</div><h3>" +
            esc(p.title) +
            "</h3><p>" +
            esc(p.excerpt) +
            "</p></a>"
          );
        })
        .join("");
    })
    .catch(function () {
      root.innerHTML =
        '<p class="loading-banner">Could not load blog posts. Run <code>npm start</code> and open this site from the server URL.</p>';
    });
})();
