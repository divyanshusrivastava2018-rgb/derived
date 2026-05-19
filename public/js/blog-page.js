(function () {
  var newsContainer = document.getElementById("newsContainer");
  var blogContainer = document.getElementById("blogContainer");
  var blogModal = document.getElementById("blogModal");
  var modalBody = document.getElementById("modalBody");
  var currentNewsFilter = "current";
  var currentBlogFilter = "all";
  var newsData = [];
  var blogsData = [];

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return "";
    }
  }

  function displayNews() {
    if (!newsContainer) return;
    var list = newsData.filter(function (n) {
      if (currentNewsFilter === "all") return true;
      return n.status === currentNewsFilter;
    });
    if (!list.length) {
      newsContainer.innerHTML =
        '<div class="no-data">No news in this section yet. Check back soon.</div>';
      return;
    }
    newsContainer.innerHTML = list
      .map(function (n) {
        return (
          '<article class="news-card" data-news-id="' +
          esc(n.id) +
          '">' +
          '<div class="news-date">' +
          esc(formatDate(n.date)) +
          "</div>" +
          "<h3>" +
          esc(n.title) +
          "</h3>" +
          "<p>" +
          esc((n.content || "").slice(0, 180)) +
          (n.content && n.content.length > 180 ? "…" : "") +
          "</p>" +
          '<button type="button" class="read-more-btn" data-news-id="' +
          esc(n.id) +
          '">Read more →</button>' +
          "</article>"
        );
      })
      .join("");
    if (!newsContainer._newsClickBound) {
      newsContainer._newsClickBound = true;
      newsContainer.addEventListener("click", function (e) {
        var btn = e.target.closest(".read-more-btn");
        var card = e.target.closest(".news-card");
        if (!card) return;
        var id =
          (btn && btn.getAttribute("data-news-id")) ||
          card.getAttribute("data-news-id");
        if (id) openNewsModal(id);
      });
    }
  }

  function displayBlogs() {
    if (!blogContainer) return;
    var list = blogsData.filter(function (b) {
      if (currentBlogFilter === "all") return true;
      return (b.tag || "").toLowerCase() === currentBlogFilter.toLowerCase();
    });
    if (!list.length) {
      blogContainer.innerHTML =
        '<div class="no-data">No blog posts in this category yet.</div>';
      return;
    }
    blogContainer.innerHTML = list
      .map(function (b) {
        var href = b.href || "/";
        return (
          '<article class="blog-card">' +
          '<div class="blog-category">' +
          esc(b.tag || "UPDATE") +
          "</div>" +
          "<h3>" +
          esc(b.title) +
          "</h3>" +
          "<p>" +
          esc(b.excerpt || "") +
          "</p>" +
          '<a href="' +
          esc(href) +
          '" class="read-more">Read article →</a>' +
          "</article>"
        );
      })
      .join("");
  }

  function openNewsModal(id) {
    var n = newsData.find(function (x) {
      return x.id === id;
    });
    if (!n || !blogModal || !modalBody) return;
    modalBody.innerHTML =
      "<h2>" +
      esc(n.title) +
      "</h2>" +
      '<p class="news-date">' +
      esc(formatDate(n.date)) +
      "</p>" +
      "<div>" +
      esc(n.content) +
      "</div>";
    blogModal.style.display = "flex";
  }

  function closeModal() {
    if (blogModal) blogModal.style.display = "none";
  }

  function apiGet(path) {
    if (window.ResearchiumApi && window.ResearchiumApi.get) {
      return window.ResearchiumApi.get(path);
    }
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    });
  }

  function loadData() {
    Promise.all([apiGet("/api/news"), apiGet("/api/blog")])
      .then(function (pair) {
        newsData = Array.isArray(pair[0]) ? pair[0] : [];
        blogsData = Array.isArray(pair[1]) ? pair[1] : [];
        displayNews();
        displayBlogs();
      })
      .catch(function () {
        if (newsContainer) {
          newsContainer.innerHTML =
            '<div class="no-data">Could not load news. Run <code>npm start</code> and open this page from the server URL.</div>';
        }
        if (blogContainer) {
          blogContainer.innerHTML =
            '<div class="no-data">Could not load blog posts. Run <code>npm start</code> and open this page from the server URL.</div>';
        }
      });
  }

  document.querySelectorAll(".news-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".news-tab").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      currentNewsFilter = btn.getAttribute("data-news-filter") || "all";
      displayNews();
    });
  });

  document.querySelectorAll(".blog-filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".blog-filter-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      currentBlogFilter = btn.getAttribute("data-blog-filter") || "all";
      displayBlogs();
    });
  });

  document.querySelector(".modal-close")?.addEventListener("click", closeModal);
  blogModal?.addEventListener("click", function (e) {
    if (e.target === blogModal) closeModal();
  });

  loadData();
})();
