const body = document.body;
const siteBasePath = document.querySelector('meta[name="site-base-path"]')?.content || "";
const sitePath = (value) => `${siteBasePath}${value}`;
const supportedLocales = ["es", "en"];
const languageStorageKey = "rtlwise-language";
const messages = {
  es: {
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    searchEmpty: "Escribe para encontrar una nota.",
    searchNoResults: "No hay señales con ese término. Prueba con otra búsqueda.",
    archiveCountOne: "nota publicada",
    archiveCountMany: "notas publicadas"
  },
  en: {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    searchEmpty: "Type to find a note.",
    searchNoResults: "No signals found for that term. Try another search.",
    archiveCountOne: "published note",
    archiveCountMany: "published notes"
  }
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function detectLocale() {
  let saved = "";
  try {
    saved = localStorage.getItem(languageStorageKey) || "";
  } catch {
    // Private browsing can make localStorage unavailable.
  }
  if (supportedLocales.includes(saved)) return saved;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || "es"];
  const preferred = languages.find((language) => supportedLocales.some((locale) => language.toLowerCase().startsWith(locale)));
  return preferred?.toLowerCase().startsWith("en") ? "en" : "es";
}

let currentLocale = supportedLocales.includes(document.documentElement.dataset.locale)
  ? document.documentElement.dataset.locale
  : detectLocale();

function setStoredLocale(locale) {
  try {
    localStorage.setItem(languageStorageKey, locale);
  } catch {
    // The preference still applies for this page when storage is unavailable.
  }
}

function updateLocaleAttributes(locale) {
  document.querySelectorAll("[data-locale-aria-es]").forEach((element) => {
    const value = element.getAttribute(`data-locale-aria-${locale}`);
    if (value) element.setAttribute("aria-label", value);
  });

  document.querySelectorAll("[data-locale-placeholder-es]").forEach((element) => {
    const value = element.getAttribute(`data-locale-placeholder-${locale}`);
    if (value) element.setAttribute("placeholder", value);
  });

  document.querySelectorAll("[data-locale-content-es]").forEach((element) => {
    const value = element.getAttribute(`data-locale-content-${locale}`);
    if (value) element.setAttribute("content", value);
  });

  document.querySelectorAll("[data-locale-text-es]").forEach((element) => {
    const value = element.getAttribute(`data-locale-text-${locale}`);
    if (value) element.textContent = value;
  });
}

const menuTrigger = document.querySelector(".menu-trigger");
const mainNav = document.querySelector("#main-nav");

function updateMenuLabel() {
  if (!menuTrigger) return;
  const key = body.classList.contains("nav-open") ? "closeMenu" : "openMenu";
  menuTrigger.setAttribute("aria-label", messages[currentLocale][key]);
}

if (menuTrigger && mainNav) {
  menuTrigger.addEventListener("click", () => {
    const open = body.classList.toggle("nav-open");
    menuTrigger.setAttribute("aria-expanded", String(open));
    updateMenuLabel();
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      body.classList.remove("nav-open");
      menuTrigger.setAttribute("aria-expanded", "false");
      updateMenuLabel();
    });
  });
}

const searchDialog = document.querySelector("#search-dialog");
const searchTrigger = document.querySelector(".search-trigger");
const searchClose = document.querySelector(".search-close");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
const languageButtons = [...document.querySelectorAll("[data-language]")];
let searchIndex = [];

function searchPostForLocale(post) {
  return post.locales?.[currentLocale] || post.locales?.es || post;
}

function renderSearchResults(query = "") {
  if (!searchResults) return;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    searchResults.innerHTML = `<p class="search-empty">${escapeHtml(messages[currentLocale].searchEmpty)}</p>`;
    return;
  }

  const matches = searchIndex.filter((post) => {
    const item = searchPostForLocale(post);
    return [item.title, item.excerpt, item.category, ...(item.tags || [])]
      .join(" ")
      .toLowerCase()
      .includes(cleanQuery);
  }).slice(0, 8);

  searchResults.innerHTML = matches.length
    ? matches.map((post) => {
      const item = searchPostForLocale(post);
      return `<a class="search-result" href="${escapeHtml(item.url)}"><small>${escapeHtml(item.category)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.excerpt)}</p></a>`;
    }).join("")
    : `<p class="search-empty">${escapeHtml(messages[currentLocale].searchNoResults)}</p>`;
}

function closeSearch() {
  if (!searchDialog) return;
  searchDialog.classList.remove("open");
  searchDialog.setAttribute("aria-hidden", "true");
  body.classList.remove("dialog-open");
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
  renderSearchResults(searchInput?.value || "");
  searchInput?.focus();
}

function normalizeTopic(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const requestedTopic = new URLSearchParams(window.location.search).get("topic");
const topicAliases = {
  hardware: "hardware",
  verilog: "verilog",
  instrumentacion: "instrumentation",
  instrumentation: "instrumentation",
  "rtl-fpga": "rtl-fpga",
  "rtl-fpga-": "rtl-fpga",
  "rtl / fpga": "rtl-fpga"
};
const activeTopic = requestedTopic ? (topicAliases[normalizeTopic(requestedTopic)] || topicAliases[requestedTopic.toLowerCase()] || normalizeTopic(requestedTopic)) : "all";

function applyArchiveFilter() {
  const localeContent = document.querySelector(`.locale-content[data-locale="${currentLocale}"]`);
  const archiveCards = [...(localeContent?.querySelectorAll(".archive-card") || [])];
  if (!archiveCards.length) return;

  let visible = 0;
  archiveCards.forEach((card) => {
    const topics = (card.dataset.topics || "").split(/\s+/).filter(Boolean);
    const matches = activeTopic === "all" || topics.includes(activeTopic);
    card.classList.toggle("hidden", !matches);
    if (matches) visible += 1;
  });

  const count = localeContent.querySelector(".archive-count");
  if (count) {
    const label = visible === 1 ? messages[currentLocale].archiveCountOne : messages[currentLocale].archiveCountMany;
    count.textContent = `${visible} ${label}`;
  }

  localeContent.querySelectorAll(".topic-filters .topic-chip").forEach((filter) => {
    filter.classList.toggle("active", (filter.dataset.topic || "all") === activeTopic);
  });
}

function applyLocale(locale, persist = false) {
  if (!supportedLocales.includes(locale)) return;
  currentLocale = locale;
  document.documentElement.dataset.locale = locale;
  document.documentElement.lang = locale;
  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === locale));
  });
  updateLocaleAttributes(locale);
  updateMenuLabel();
  renderSearchResults(searchInput?.value || "");
  applyArchiveFilter();
  if (persist) setStoredLocale(locale);
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => applyLocale(button.dataset.language, true));
});

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
    updateMenuLabel();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});

applyLocale(currentLocale);
