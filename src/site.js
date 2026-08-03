const body = document.body;
const siteBasePath = document.querySelector('meta[name="site-base-path"]')?.content || "";
const sitePath = (value) => `${siteBasePath}${value}`;
const menuTrigger = document.querySelector(".menu-trigger");
const mainNav = document.querySelector("#main-nav");

if (menuTrigger && mainNav) {
  menuTrigger.addEventListener("click", () => {
    const open = body.classList.toggle("nav-open");
    menuTrigger.setAttribute("aria-expanded", String(open));
    menuTrigger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      body.classList.remove("nav-open");
      menuTrigger.setAttribute("aria-expanded", "false");
      menuTrigger.setAttribute("aria-label", "Abrir menú");
    });
  });
}

const searchDialog = document.querySelector("#search-dialog");
const searchTrigger = document.querySelector(".search-trigger");
const searchClose = document.querySelector(".search-close");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
let searchIndex = [];

function closeSearch() {
  if (!searchDialog) return;
  searchDialog.classList.remove("open");
  searchDialog.setAttribute("aria-hidden", "true");
  body.classList.remove("dialog-open");
}

function renderSearchResults(query = "") {
  if (!searchResults) return;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    searchResults.innerHTML = '<p class="search-empty">Escribe para encontrar una nota.</p>';
    return;
  }

  const matches = searchIndex.filter((post) => [post.title, post.excerpt, post.category, ...(post.tags || [])].join(" ").toLowerCase().includes(cleanQuery)).slice(0, 8);
  searchResults.innerHTML = matches.length
    ? matches.map((post) => `<a class="search-result" href="${post.url}"><small>${post.category}</small><strong>${post.title}</strong><p>${post.excerpt}</p></a>`).join("")
    : '<p class="search-empty">No hay señales con ese término. Prueba con otra búsqueda.</p>';
}

async function openSearch() {
  if (!searchDialog) return;
  searchDialog.classList.add("open");
  searchDialog.setAttribute("aria-hidden", "false");
  body.classList.add("dialog-open");
  if (!searchIndex.length) {
    try {
      const response = await fetch(sitePath("/posts.json"));
      searchIndex = await response.json();
    } catch {
      searchIndex = [];
    }
  }
  searchInput?.focus();
}

searchTrigger?.addEventListener("click", openSearch);
searchClose?.addEventListener("click", closeSearch);
searchDialog?.addEventListener("click", (event) => {
  if (event.target === searchDialog) closeSearch();
});
searchInput?.addEventListener("input", (event) => renderSearchResults(event.target.value));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearch();
    body.classList.remove("nav-open");
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});

const archiveCards = [...document.querySelectorAll(".archive-card")];
const topic = new URLSearchParams(window.location.search).get("topic");
if (archiveCards.length && topic) {
  const normalizedTopic = topic.toLowerCase();
  let visible = 0;
  archiveCards.forEach((card) => {
    const searchable = `${card.dataset.category || ""} ${card.dataset.tags || ""}`.toLowerCase();
    const matches = searchable.includes(normalizedTopic);
    card.classList.toggle("hidden", !matches);
    if (matches) visible += 1;
  });
  const count = document.querySelector(".archive-count");
  if (count) count.textContent = `${visible} ${visible === 1 ? "nota publicada" : "notas publicadas"}`;
  document.querySelectorAll(".topic-filters .topic-chip").forEach((filter) => {
    filter.classList.toggle("active", filter.textContent.trim().toLowerCase() === normalizedTopic);
  });
}
