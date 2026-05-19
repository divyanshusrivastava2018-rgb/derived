const API = "/api/courses";

let courses = [];
let filteredCourses = [];
let currentPage = 1;
const CARDS_PER_PAGE = 9;

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function ytThumbUrl(ytId) {
  return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
}

async function refreshCourses() {
  const grid = document.getElementById("allCoursesGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="loading-banner u-span-courses-grid">Loading courses…</div>';
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error("Failed to load");
    courses = await r.json();
    applyFilters();
  } catch (e) {
    grid.innerHTML =
      '<div class="empty-state u-span-courses-grid"><h3>Could not reach server</h3><p>Run <code>npm start</code> and open this page from ' + (window.location.origin || "http://localhost:3000") + '</p></div>';
    showToast("API unavailable — start the server with npm start", "error");
  }
}

function renderCard(c) {
  const isFree = !c.price || c.price === 0;
  let badgeHtml = "";
  if (c.type === "youtube") badgeHtml = '<span class="card-badge badge-yt">▶ YouTube</span>';
  else if (c.type === "upload") badgeHtml = '<span class="card-badge badge-upload">📁 Uploaded</span>';
  else badgeHtml = isFree ? '<span class="card-badge badge-free">FREE</span>' : '<span class="card-badge badge-paid">PAID</span>';

  let thumbHtml;
  if (c.thumbUrl) {
    thumbHtml = `<img src="${escapeHtml(c.thumbUrl)}" alt="" loading="lazy"/>`;
  } else if (c.type === "youtube" && c.ytId) {
    thumbHtml = `<img class="card-thumb-yt-img" src="${ytThumbUrl(c.ytId)}" alt="" loading="lazy" data-yt-thumb="1"/>
    <div class="card-thumb-placeholder card-thumb-yt-fallback u-hidden" aria-hidden="true">🎬</div>`;
  } else {
    const icons = { youtube: "🎬", upload: "📁", external: "🌐" };
    thumbHtml = `<div class="card-thumb-placeholder">${icons[c.type] || "📚"}</div>`;
  }

  const priceDisplay = isFree
    ? `<span class="card-price free">FREE</span>`
    : `<span class="card-price">₹${Number(c.price).toLocaleString()}</span>`;
  const id = escapeHtml(c.id);
  const title = escapeHtml(c.title);
  const category = escapeHtml(c.category);
  const instructor = escapeHtml(c.instructor || "Researchium");
  const level = escapeHtml(c.level || "");

  return `
    <div class="course-card" data-id="${id}">
      <div class="card-thumb">
        ${thumbHtml}
        ${badgeHtml}
        <div class="play-overlay"><div class="play-btn">▶</div></div>
      </div>
      <div class="card-body">
        <div class="card-category">${category}</div>
        <div class="card-title">${title}</div>
        <div class="card-instructor">👤 ${instructor} · ${level}</div>
        <div class="card-meta">
          <span class="card-rating">${c.rating || 4.5} ⭐ (${Number(c.students || 0).toLocaleString()})</span>
          ${priceDisplay}
        </div>
        <div class="card-actions">
          <button type="button" class="btn-card btn-card-primary btn-watch" data-id="${id}">▶ Watch</button>
          <button type="button" class="btn-card btn-card-ghost">+ Enroll</button>
        </div>
      </div>
    </div>`;
}

function applyFilters() {
  const query = document.getElementById("searchBox").value.toLowerCase();
  const checkedCategories = [...document.querySelectorAll('[data-filter="category"]:checked')].map((e) => e.value);
  const checkedLevels = [...document.querySelectorAll('[data-filter="level"]:checked')].map((e) => e.value);
  const checkedTypes = [...document.querySelectorAll('[data-filter="type"]:checked')].map((e) => e.value);
  const checkedPrices = [...document.querySelectorAll('[data-filter="price"]:checked')].map((e) => e.value);
  const checkedLangs = [...document.querySelectorAll('[data-filter="lang"]:checked')].map((e) => e.value);
  const sort = document.getElementById("sortSelect").value;

  filteredCourses = courses.filter((c) => {
    const matchQ =
      !query ||
      (c.title || "").toLowerCase().includes(query) ||
      (c.instructor || "").toLowerCase().includes(query) ||
      (c.category || "").toLowerCase().includes(query);
    const matchCat = checkedCategories.includes(c.category);
    const matchLvl = checkedLevels.includes(c.level);
    const matchType = checkedTypes.includes(c.type);
    const isFree = !c.price || c.price === 0;
    const matchPrice = (isFree && checkedPrices.includes("free")) || (!isFree && checkedPrices.includes("paid"));
    const matchLang = checkedLangs.includes(c.lang || "English");
    return matchQ && matchCat && matchLvl && matchType && matchPrice && matchLang;
  });

  if (sort === "popular") filteredCourses.sort((a, b) => (b.students || 0) - (a.students || 0));
  else if (sort === "rating") filteredCourses.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === "newest") filteredCourses.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === "price-asc") filteredCourses.sort((a, b) => (a.price || 0) - (b.price || 0));

  currentPage = 1;
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById("allCoursesGrid");
  const start = (currentPage - 1) * CARDS_PER_PAGE;
  const pageItems = filteredCourses.slice(start, start + CARDS_PER_PAGE);

  document.getElementById("resultsCount").textContent = `Showing ${filteredCourses.length} course${filteredCourses.length !== 1 ? "s" : ""}`;
  document.getElementById("courseCountTag").textContent = `${courses.length.toLocaleString()}+ COURSES AVAILABLE`;

  if (filteredCourses.length === 0) {
    grid.innerHTML = `<div class="empty-state u-span-courses-grid">
      <div class="empty-state-icon">📭</div>
      <h3>No courses found</h3>
      <p>Try adjusting your filters or search terms.</p>
    </div>`;
  } else {
    grid.innerHTML = pageItems.map(renderCard).join("");
    grid.querySelectorAll("img[data-yt-thumb]").forEach((img) => {
      img.addEventListener("error", () => {
        img.classList.add("u-hidden");
        const ph = img.nextElementSibling;
        if (ph && ph.classList.contains("card-thumb-yt-fallback")) {
          ph.classList.remove("u-hidden");
        }
      });
    });
    grid.querySelectorAll(".course-card").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (ev.target.closest(".card-actions")) return;
        openCourse(el.dataset.id);
      });
    });
    grid.querySelectorAll(".btn-watch").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openCourse(btn.dataset.id);
      });
    });
  }

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredCourses.length / CARDS_PER_PAGE);
  const pag = document.getElementById("pagination");
  if (total <= 1) {
    pag.innerHTML = "";
    return;
  }
  let html = "";
  for (let i = 1; i <= total; i++) {
    html += `<button type="button" class="pag-btn${i === currentPage ? " active" : ""}" data-page="${i}">${i}</button>`;
  }
  if (currentPage < total)
    html += `<button type="button" class="pag-btn" data-page="${currentPage + 1}">→</button>`;
  pag.innerHTML = html;
  pag.querySelectorAll("[data-page]").forEach((b) => {
    b.addEventListener("click", () => goPage(Number(b.dataset.page)));
  });
}

function goPage(n) {
  currentPage = n;
  renderGrid();
  const layout = document.querySelector(".courses-layout");
  if (layout) window.scrollTo({ top: layout.offsetTop - 100, behavior: "smooth" });
}

function openCourse(id) {
  const c = courses.find((x) => x.id === id);
  if (!c) return;
  window.location.href = `/watch.html?id=${encodeURIComponent(id)}`;
}

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

function applyQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const searchBox = document.getElementById("searchBox");
  if (q && searchBox) searchBox.value = q;
}

function bindUi() {
  document.querySelectorAll(".filter-cb").forEach((cb) => cb.addEventListener("change", applyFilters));
  const searchBox = document.getElementById("searchBox");
  if (searchBox) searchBox.addEventListener("input", applyFilters);
  document.getElementById("btnSearchCourses")?.addEventListener("click", applyFilters);
  document.getElementById("sortSelect")?.addEventListener("change", applyFilters);
}

applyQueryFromUrl();
bindUi();
refreshCourses();
