import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const postsDir = path.join(root, "content", "posts");
const englishPostsDir = path.join(postsDir, "en");
const publicDir = path.join(root, "public");
const sourceDir = path.join(root, "src");
const distDir = path.join(root, "dist");

const locales = ["es", "en"];
const topics = [
  { key: "rtl-fpga", es: "RTL / FPGA", en: "RTL / FPGA" },
  { key: "hardware", es: "Hardware", en: "Hardware" },
  { key: "verilog", es: "Verilog", en: "Verilog" },
  { key: "instrumentation", es: "Instrumentación", en: "Instrumentation" }
];

const copy = {
  es: {
    navHome: "Inicio",
    navNotes: "Notas",
    mainNavLabel: "Navegación principal",
    search: "Buscar",
    aboutCta: "Sobre el proyecto",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    languageLabel: "Idioma",
    searchClose: "Cerrar búsqueda",
    searchTitle: "Buscar en RTLwise",
    searchPlaceholder: "Prueba: UART, alimentación…",
    searchEmpty: "Escribe para encontrar una nota.",
    searchNoResults: "No hay señales con ese término. Prueba con otra búsqueda.",
    footerDescription: "Ideas prácticas de MDaniel para diseñar, depurar y entender hardware digital.",
    explore: "Explora",
    allNotes: "Todas las notas",
    connect: "Conecta",
    rssTitle: "RSS de RTLwise",
    footerTagline: "Hecho con curiosidad y un osciloscopio.",
    homeTitle: "Hardware y RTL, explicado sin ruido",
    homeDescription: "Hardware y RTL, explicado sin ruido.",
    labNotebook: "Cuaderno de laboratorio",
    byAuthor: "Por MDaniel",
    publishedOn: "Publicado el",
    hardwareRtl: "Hardware / RTL",
    imageNote: "señal limpia, diseño claro",
    introIndex: "01 — QUÉ ENCONTRARÁS",
    introTitle: "Menos teoría de escaparate.",
    introAccent: "Más cosas que funcionan.",
    introCopy: "RTLwise es un lugar para entender el hardware desde la mesa de trabajo: señales, placas, código y las pequeñas decisiones que hacen que un diseño sea estable.",
    introLink: "Conoce el proyecto",
    topicsIndex: "02 — FILTRA POR TEMA",
    topicsTitle: "Elige tu siguiente experimento.",
    viewAllNotes: "Ver todas las notas",
    latestIndex: "03 — RECIÉN SALIDO DEL LAB",
    latestTitle: "Últimas notas",
    latestAside: "Notas cortas, esquemas largos.",
    readNote: "Leer la nota",
    newsletterIndex: "UNA SEÑAL A LA SEMANA",
    newsletterTitle: "Hardware sin ruido",
    newsletterAccent: "en tu bandeja.",
    newsletterEmailLabel: "Tu email",
    newsletterPlaceholder: "tu@email.com",
    newsletterButton: "Apuntarme",
    newsletterNote: "La newsletter estará disponible próximamente.",
    newsletterWatermark: "PRÓXIMAMENTE",
    archiveLabel: "ARCHIVO RTLWISE",
    archiveTitle: "Todas las notas",
    archiveAccent: "del laboratorio.",
    archiveDescription: "Una colección creciente de apuntes sobre hardware, RTL, FPGA e instrumentación práctica.",
    allTopic: "Todo",
    archiveCountOne: "nota publicada",
    archiveCountMany: "notas publicadas",
    articleBack: "Volver a las notas",
    readUnit: "de lectura",
    figurePrefix: "FIG. /",
    toc: "En esta nota",
    tocContext: "Contexto",
    tocSteps: "Pasos",
    tocChecklist: "Checklist",
    share: "Compartir",
    usefulQuestion: "¿Te ha servido?",
    usefulText: "Guárdalo para la próxima sesión de laboratorio.",
    relatedIndex: "SIGUE EXPLORANDO",
    relatedTitle: "Más señales útiles",
    viewArchive: "Ver archivo",
    aboutLabel: "SOBRE RTLWISE",
    aboutTitle: "Diseñar mejor empieza por",
    aboutAccent: "mirar mejor.",
    aboutIntro: "Un blog para quienes disfrutan entendiendo qué pasa entre el pin, la señal y el código.",
    aboutStatement: "La ingeniería también se aprende siguiendo una pista.",
    aboutCopyOne: "RTLwise reúne notas pequeñas y concretas sobre hardware digital. La idea es documentar el camino completo: elegir un componente, dibujar un esquema, escribir RTL, medir una señal y volver a intentarlo.",
    aboutCopyTwo: "No hace falta tener un laboratorio perfecto. Hace falta una pregunta buena, una placa a mano y la paciencia de mirar los detalles.",
    principleOne: "Claro antes que brillante",
    principleTwo: "Medir antes de adivinar",
    principleThree: "Compartir lo que falla",
    aboutCtaQuestion: "¿Tienes una señal que seguir?",
    visitGithub: "Visita GitHub",
    notFoundLabel: "ERROR 404",
    notFoundTitle: "Esta señal",
    notFoundAccent: "se ha perdido.",
    notFoundCopy: "La página que buscas no está en este bus. Vuelve al inicio y seguimos desde ahí.",
    backHome: "Volver a la portada",
    titleArchive: "Todas las notas",
    descriptionArchive: "Archivo de notas sobre hardware, RTL y FPGA.",
    titleAbout: "Sobre el proyecto",
    descriptionAbout: "Conoce la idea detrás de RTLwise.",
    titleNotFound: "Página no encontrada",
    descriptionNotFound: "La página solicitada no existe."
  },
  en: {
    navHome: "Home",
    navNotes: "Notes",
    mainNavLabel: "Main navigation",
    search: "Search",
    aboutCta: "About the project",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    languageLabel: "Language",
    searchClose: "Close search",
    searchTitle: "Search RTLwise",
    searchPlaceholder: "Try: UART, power supply…",
    searchEmpty: "Type to find a note.",
    searchNoResults: "No signals found for that term. Try another search.",
    footerDescription: "Practical ideas from MDaniel for designing, debugging, and understanding digital hardware.",
    explore: "Explore",
    allNotes: "All notes",
    connect: "Connect",
    rssTitle: "RTLwise RSS",
    footerTagline: "Made with curiosity and an oscilloscope.",
    homeTitle: "Hardware and RTL, without the noise",
    homeDescription: "Hardware and RTL, without the noise.",
    labNotebook: "Lab notebook",
    byAuthor: "By MDaniel",
    publishedOn: "Published on",
    hardwareRtl: "Hardware / RTL",
    imageNote: "clean signal, clear design",
    introIndex: "01 — WHAT YOU'LL FIND",
    introTitle: "Less showroom theory.",
    introAccent: "More things that work.",
    introCopy: "RTLwise is a place to understand hardware from the workbench: signals, boards, code, and the small decisions that make a design stable.",
    introLink: "Meet the project",
    topicsIndex: "02 — FILTER BY TOPIC",
    topicsTitle: "Choose your next experiment.",
    viewAllNotes: "View all notes",
    latestIndex: "03 — FRESH FROM THE LAB",
    latestTitle: "Latest notes",
    latestAside: "Short notes, long schematics.",
    readNote: "Read the note",
    newsletterIndex: "ONE SIGNAL A WEEK",
    newsletterTitle: "Hardware without the noise",
    newsletterAccent: "in your inbox.",
    newsletterEmailLabel: "Your email",
    newsletterPlaceholder: "you@email.com",
    newsletterButton: "Sign me up",
    newsletterNote: "The newsletter will be available soon.",
    newsletterWatermark: "COMING SOON",
    archiveLabel: "RTLWISE ARCHIVE",
    archiveTitle: "All notes",
    archiveAccent: "from the lab.",
    archiveDescription: "A growing collection of notes about hardware, RTL, FPGA, and practical instrumentation.",
    allTopic: "All",
    archiveCountOne: "published note",
    archiveCountMany: "published notes",
    articleBack: "Back to notes",
    readUnit: "read",
    figurePrefix: "FIG. /",
    toc: "In this note",
    tocContext: "Context",
    tocSteps: "Steps",
    tocChecklist: "Checklist",
    share: "Share",
    usefulQuestion: "Was this useful?",
    usefulText: "Save it for your next lab session.",
    relatedIndex: "KEEP EXPLORING",
    relatedTitle: "More useful signals",
    viewArchive: "View archive",
    aboutLabel: "ABOUT RTLWISE",
    aboutTitle: "Better design starts with",
    aboutAccent: "looking closer.",
    aboutIntro: "A blog for people who enjoy understanding what happens between the pin, the signal, and the code.",
    aboutStatement: "Engineering is also learned by following a clue.",
    aboutCopyOne: "RTLwise collects small, concrete notes about digital hardware. The idea is to document the whole path: choosing a component, drawing a schematic, writing RTL, measuring a signal, and trying again.",
    aboutCopyTwo: "You do not need a perfect lab. You need a good question, a board within reach, and the patience to look at the details.",
    principleOne: "Clear before clever",
    principleTwo: "Measure before guessing",
    principleThree: "Share what fails",
    aboutCtaQuestion: "Have a signal to follow?",
    visitGithub: "Visit GitHub",
    notFoundLabel: "ERROR 404",
    notFoundTitle: "This signal",
    notFoundAccent: "has been lost.",
    notFoundCopy: "The page you are looking for is not on this bus. Go back home and we will pick it up from there.",
    backHome: "Back to the homepage",
    titleArchive: "All notes",
    descriptionArchive: "An archive of notes about hardware, RTL, and FPGA.",
    titleAbout: "About the project",
    descriptionAbout: "Learn about the idea behind RTLwise.",
    titleNotFound: "Page not found",
    descriptionNotFound: "The requested page does not exist."
  }
};

const siteOrigin = (process.env.SITE_ORIGIN || "http://localhost:4173").replace(/\/+$/, "");
const siteBasePath = (process.env.SITE_BASE_PATH || "").replace(/\/+$/, "");
const site = {
  name: "RTLwise",
  description: "Hardware y RTL, explicado sin ruido.",
  url: `${siteOrigin}${siteBasePath}`,
  basePath: siteBasePath
};

const htmlEntities = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

function t(lang, key) {
  return copy[lang]?.[key] ?? copy.es[key] ?? key;
}

function localePair(es, en = es) {
  return { es, en };
}

function localeText(key) {
  return `<span data-locale="es">${escapeHtml(t("es", key))}</span><span data-locale="en">${escapeHtml(t("en", key))}</span>`;
}

function localeAttribute(name, pair) {
  const values = localePair(pair.es, pair.en);
  return `data-locale-${name}-es="${escapeHtml(values.es)}" data-locale-${name}-en="${escapeHtml(values.en)}"`;
}

function normalizeTopic(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function topicKeysForPost(post) {
  const values = [post.category, ...post.tags].map(normalizeTopic);
  return topics
    .filter((topic) => values.includes(normalizeTopic(topic.es)) || values.includes(normalizeTopic(topic.en)) || (topic.key === "rtl-fpga" && (values.includes("rtl") || values.includes("fpga"))))
    .map((topic) => topic.key);
}

function localizedPost(post, lang) {
  return post.locales?.[lang] || post.locales?.es || post;
}

function localeContent(bodyByLocale) {
  return locales.map((lang) => `<div class="locale-content" data-locale="${lang}">${bodyByLocale[lang]}</div>`).join("");
}

function sitePath(value = "/") {
  const target = String(value);
  if (!target.startsWith("/")) return target;
  if (!site.basePath) return target;
  return target === "/" ? `${site.basePath}/` : `${site.basePath}${target}`;
}

function absoluteUrl(value = "/") {
  const target = String(value);
  return `${site.url}${target.startsWith("/") ? target : `/${target}`}`;
}

function safeUrl(value = "") {
  const url = String(value).trim();
  if (/^(https?:\/\/|mailto:)/i.test(url) || url.startsWith("#")) return url;
  if (url.startsWith("/")) return sitePath(url);
  return "#";
}

function parseScalar(value) {
  const clean = value.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.slice(1, -1);
  }
  if (clean.startsWith("[") && clean.endsWith("]")) {
    return clean.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  return clean;
}

function parseFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: normalized };

  const data = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    data[key] = parseScalar(line.slice(separator + 1));
  }
  return { data, body: normalized.slice(end + 4).replace(/^\n/, "") };
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  const tokens = [];
  const token = (html) => {
    const id = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return id;
  };

  text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${code}</code>`));
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\)/g, (_, alt, url, title) => {
    const caption = title ? ` title="${title}"` : "";
    return token(`<img src="${safeUrl(url)}" alt="${alt}"${caption} loading="lazy">`);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\)/g, (_, label, url, title) => {
    const target = safeUrl(url);
    const external = /^https?:\/\//i.test(target) ? ' target="_blank" rel="noreferrer"' : "";
    const titleAttribute = title ? ` title="${title}"` : "";
    return token(`<a href="${target}"${external}${titleAttribute}>${label}</a>`);
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

  const resolveTokens = (value) => value.replace(/\u0000(\d+)\u0000/g, (_, index) => resolveTokens(tokens[Number(index)]));
  return resolveTokens(text);
}

function headingId(value) {
  return value.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = null;
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    output.push(`</${list}>`);
    list = null;
  };

  const flushQuote = () => {
    if (!quote.length) return;
    output.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
    quote = [];
  };

  const closeCode = () => {
    if (!code) return;
    const language = code.trim() ? ` class="language-${escapeHtml(code.trim())}"` : "";
    output.push(`<pre><code${language}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    code = null;
    codeLines = [];
  };

  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line.trim())) closeCode();
      else codeLines.push(line);
      continue;
    }

    const fence = line.match(/^\s*```\s*([^ ]*)\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      flushQuote();
      code = fence[1] || "";
      continue;
    }

    const quoteLine = line.match(/^\s*>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      closeList();
      quote.push(quoteLine[1]);
      continue;
    }
    if (quote.length) flushQuote();

    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level} id="${headingId(heading[2])}">${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
      continue;
    }

    const image = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\)\s*$/);
    if (image) {
      flushParagraph();
      closeList();
      const title = image[3] ? `<figcaption>${inlineMarkdown(image[3])}</figcaption>` : "";
      output.push(`<figure><img src="${safeUrl(image[2])}" alt="${image[1]}" loading="lazy">${title}</figure>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextList = ordered ? "ol" : "ul";
      if (list && list !== nextList) closeList();
      if (!list) {
        list = nextList;
        output.push(`<${list}>`);
      }
      output.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  closeCode();
  flushParagraph();
  closeList();
  flushQuote();
  return output.join("\n");
}

function formatDate(date, lang = "es") {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${date}T12:00:00`))
    .replace(" de ", " ")
    .replace(" de ", " ");
}

function icon(name, className = "") {
  const common = `class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  const paths = {
    arrow: `<svg ${common}><path d="M5 12h13M13 6l6 6-6 6"/></svg>`,
    arrowUp: `<svg ${common}><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
    search: `<svg ${common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></svg>`,
    menu: `<svg ${common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    close: `<svg ${common}><path d="m6 6 12 12M18 6 6 18"/></svg>`,
    external: `<svg ${common}><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
    rss: `<svg ${common}><path d="M5 19h.01M5 12a7 7 0 0 1 7 7M5 5a14 14 0 0 1 14 14"/></svg>`,
    check: `<svg ${common}><path d="m5 12 4 4L19 6"/></svg>`
  };
  return paths[name] || "";
}

function logo() {
  return `<a class="brand" href="${sitePath("/")}" aria-label="RTLwise"><span class="brand-mark"><i></i><i></i><i></i></span><span>RTL<span class="brand-accent">wise</span></span></a>`;
}

function header(active = "home") {
  const links = [
    ["home", "navHome", "/"],
    ["archive", "navNotes", "/posts.html"]
  ];
  const languageSwitcher = `<div class="language-switcher" role="group" ${localeAttribute("aria", localePair(t("es", "languageLabel"), t("en", "languageLabel")))}><span class="sr-only">${localeText("languageLabel")}</span><button class="language-button" type="button" data-language="es" aria-pressed="true">ES</button><span class="language-divider" aria-hidden="true">/</span><button class="language-button" type="button" data-language="en" aria-pressed="false">EN</button></div>`;
  return `<header class="site-header"><div class="container header-inner">${logo()}<nav class="main-nav" id="main-nav" ${localeAttribute("aria", localePair(t("es", "mainNavLabel"), t("en", "mainNavLabel")))}>${links.map(([key, label, href]) => `<a class="${active === key ? "active" : ""}" href="${sitePath(href)}"${active === key ? ' aria-current="page"' : ""}>${localeText(label)}</a>`).join("")}</nav><div class="header-actions">${languageSwitcher}<button class="icon-button search-trigger" type="button" ${localeAttribute("aria", localePair(t("es", "search"), t("en", "search")))} aria-controls="search-dialog">${icon("search")}</button><a class="header-cta" href="${sitePath("/about.html")}">${localeText("aboutCta")} ${icon("arrow")}</a><button class="icon-button menu-trigger" type="button" ${localeAttribute("aria", localePair(t("es", "openMenu"), t("en", "openMenu")))} aria-expanded="false" aria-controls="main-nav">${icon("menu")}</button></div></div></header>`;
}

function footer() {
  const rtlTopic = topics[0];
  const hardwareTopic = topics[1];
  return `<footer class="site-footer"><div class="container footer-top"><div><div class="footer-brand">${logo()}</div><p>${localeText("footerDescription")}</p></div><div class="footer-links"><div><span class="footer-label">${localeText("explore")}</span><a href="${sitePath("/posts.html")}">${localeText("allNotes")}</a><a href="${sitePath(`/posts.html?topic=${hardwareTopic.key}`)}">${topicLabel(hardwareTopic)}</a><a href="${sitePath(`/posts.html?topic=${rtlTopic.key}`)}">${topicLabel(rtlTopic)}</a></div><div><span class="footer-label">${localeText("connect")}</span><a href="https://github.com/MDaniel592" target="_blank" rel="noreferrer">GitHub / MDaniel592 ${icon("external")}</a><a href="${sitePath("/feed.xml")}">RSS ${icon("rss")}</a></div></div></div><div class="container footer-bottom"><span>© 2026 MDaniel · RTLwise</span><span>${localeText("footerTagline")}</span></div></footer>`;
}

function structuredData(data) {
  if (!data) return "";
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function page({ title, description = localePair(site.description, copy.en.homeDescription), active = "", body, bodyClass = "", canonicalPath = "/", image = "/favicon.svg", robots = "index,follow", openGraphType = "website", data = null }) {
  const titlePair = typeof title === "string" ? localePair(title) : title;
  const descriptionPair = typeof description === "string" ? localePair(description) : description;
  const htmlTitle = localePair(`${titlePair.es} · ${site.name}`, `${titlePair.en} · ${site.name}`);
  const canonical = canonicalPath === null ? "" : absoluteUrl(canonicalPath);
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const socialImage = absoluteUrl(image);
  const bootstrap = `<script>(() => { const supported = ["es", "en"]; let saved = ""; try { saved = localStorage.getItem("rtlwise-language") || ""; } catch {} const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language || "es"]; const browserLocale = browserLanguages.find((value) => supported.some((language) => value.toLowerCase().startsWith(language))) || "es"; const locale = supported.includes(saved) ? saved : (browserLocale.toLowerCase().startsWith("en") ? "en" : "es"); document.documentElement.dataset.locale = locale; document.documentElement.lang = locale; })();</script>`;
  const meta = (name, pair, property = false) => `<meta ${property ? "property" : "name"}="${name}" content="${escapeHtml(pair.es)}" ${localeAttribute("content", pair)}>`;
  const titleMeta = localeAttribute("text", htmlTitle);
  const localizedBody = typeof body === "string" ? localePair(body) : body;
  return `<!doctype html><html lang="es" data-locale="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="site-base-path" content="${escapeHtml(site.basePath)}">${meta("description", descriptionPair)}<meta name="author" content="MDaniel"><meta name="robots" content="${robots}"><meta name="theme-color" content="#1b211d">${canonicalTag}${meta("og:type", localePair(openGraphType), true)}<meta property="og:site_name" content="${site.name}">${meta("og:locale", localePair("es_ES", "en_US"), true)}${meta("og:title", titlePair, true)}${meta("og:description", descriptionPair, true)}<meta property="og:url" content="${escapeHtml(canonical || absoluteUrl("/"))}"><meta property="og:image" content="${escapeHtml(socialImage)}">${meta("og:image:alt", titlePair, true)}<meta name="twitter:card" content="summary_large_image">${meta("twitter:title", titlePair)}${meta("twitter:description", descriptionPair)}<meta name="twitter:image" content="${escapeHtml(socialImage)}"><title ${titleMeta}>${escapeHtml(htmlTitle.es)}</title><link rel="icon" href="${sitePath("/favicon.svg")}" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="${escapeHtml(t("es", "rssTitle"))}" href="${sitePath("/feed.xml")}"><link rel="stylesheet" href="${sitePath("/assets/styles.css")}">${bootstrap}${structuredData(data)}</head><body class="${bodyClass}">${header(active)}<main>${localeContent(localizedBody)}</main>${footer()}<div class="search-dialog" id="search-dialog" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="search-title"><div class="search-panel"><div class="search-panel-head"><span id="search-title">${localeText("searchTitle")}</span><button class="icon-button search-close" type="button" ${localeAttribute("aria", localePair(t("es", "searchClose"), t("en", "searchClose")))}>${icon("close")}</button></div><label class="search-input-wrap">${icon("search")}<span class="sr-only">${localeText("search")}</span><input id="search-input" type="search" ${localeAttribute("placeholder", localePair(t("es", "searchPlaceholder"), t("en", "searchPlaceholder")))} autocomplete="off"></label><div class="search-results" id="search-results"><p class="search-empty">${localeText("searchEmpty")}</p></div></div></div><script src="${sitePath("/assets/site.js")}" defer></script></body></html>`;
}

function postCard(post, lang, variant = "") {
  const item = localizedPost(post, lang);
  return `<article class="post-card ${variant}" data-topics="${escapeHtml(post.topicKeys.join(" "))}"><a class="card-image" href="${sitePath(item.url)}"><img src="${sitePath(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy"><span class="card-arrow">${icon("arrow")}</span></a><div class="card-body"><div class="post-meta"><span>${escapeHtml(item.category)}</span><span class="dot"></span><time datetime="${item.date}">${formatDate(item.date, lang)}</time></div><h3><a href="${sitePath(item.url)}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt)}</p><a class="text-link" href="${sitePath(item.url)}">${escapeHtml(t(lang, "readNote"))} ${icon("arrow")}</a></div></article>`;
}

function topicLabel(topic) {
  return `<span data-locale="es">${escapeHtml(topic.es)}</span><span data-locale="en">${escapeHtml(topic.en)}</span>`;
}

function topicChip(topic, lang, active = false) {
  return `<a class="topic-chip ${active ? "active" : ""}" data-topic="${topic.key}" href="${sitePath(`/posts.html?topic=${encodeURIComponent(topic.key)}`)}">${escapeHtml(topic[lang])}</a>`;
}

function comingSoonSection(lang) {
  return `<section class="newsletter-section"><div class="container newsletter-box"><div class="newsletter-symbol">↗</div><div><span class="section-index">${escapeHtml(t(lang, "newsletterIndex"))}</span><h2>${escapeHtml(t(lang, "newsletterTitle"))}<br><em>${escapeHtml(t(lang, "newsletterAccent"))}</em></h2></div><form class="newsletter-form" aria-label="${escapeHtml(t(lang, "newsletterNote"))}"><label class="sr-only" for="newsletter-email-${lang}">${escapeHtml(t(lang, "newsletterEmailLabel"))}</label><input id="newsletter-email-${lang}" type="email" placeholder="${escapeHtml(t(lang, "newsletterPlaceholder"))}" disabled><button type="submit" disabled>${escapeHtml(t(lang, "newsletterButton"))} ${icon("arrow")}</button><p class="form-note">${escapeHtml(t(lang, "newsletterNote"))}</p></form><span class="newsletter-watermark" aria-hidden="true">${escapeHtml(t(lang, "newsletterWatermark"))}</span></div></section>`;
}

function renderHomeBody(posts, lang) {
  const featured = posts.find((post) => post.featured) || posts[0];
  const latest = posts.filter((post) => post.slug !== featured.slug).slice(0, 4);
  const item = localizedPost(featured, lang);
  return `<section class="hero-section"><div class="container"><div class="hero-kicker"><span class="live-dot"></span> ${escapeHtml(t(lang, "labNotebook"))} <span class="hero-line"></span> MDaniel · 01 / ${String(posts.length).padStart(2, "0")}</div><div class="hero-card"><div class="hero-copy"><div class="eyebrow">${escapeHtml(item.category)} <span>·</span> ${escapeHtml(item.readTime)}</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.excerpt)}</p><div class="hero-details"><div class="author-mark">M</div><div><strong>${escapeHtml(t(lang, "byAuthor"))}</strong><span>${escapeHtml(t(lang, "publishedOn"))} ${formatDate(item.date, lang)} · ${escapeHtml(t(lang, "hardwareRtl"))}</span></div><a class="round-link" href="${sitePath(item.url)}" aria-label="${escapeHtml(t(lang, "readNote"))}: ${escapeHtml(item.title)}">${icon("arrow")}</a></div></div><a class="hero-image" href="${sitePath(item.url)}"><img src="${sitePath(item.image)}" alt="${escapeHtml(item.imageAlt)}"><span class="image-note">FIG. 01 <span>${escapeHtml(t(lang, "imageNote"))}</span></span></a></div></div></section><section class="intro-section"><div class="container intro-grid"><div><span class="section-index">${escapeHtml(t(lang, "introIndex"))}</span><h2>${escapeHtml(t(lang, "introTitle"))}<br><em>${escapeHtml(t(lang, "introAccent"))}</em></h2></div><div class="intro-copy"><p>${escapeHtml(t(lang, "introCopy"))}</p><a class="text-link dark-link" href="${sitePath("/about.html")}">${escapeHtml(t(lang, "introLink"))} ${icon("arrow")}</a></div></div></section><section class="topics-section"><div class="container"><div class="section-heading"><div><span class="section-index">${escapeHtml(t(lang, "topicsIndex"))}</span><h2>${escapeHtml(t(lang, "topicsTitle"))}</h2></div><a class="text-link" href="${sitePath("/posts.html")}">${escapeHtml(t(lang, "viewAllNotes"))} ${icon("arrow")}</a></div><div class="topics-list">${topics.map((topic) => topicChip(topic, lang)).join("")}</div></div></section><section class="latest-section"><div class="container"><div class="section-heading"><div><span class="section-index">${escapeHtml(t(lang, "latestIndex"))}</span><h2>${escapeHtml(t(lang, "latestTitle"))}</h2></div><span class="section-aside">${escapeHtml(t(lang, "latestAside"))}</span></div><div class="post-grid">${latest.map((post) => postCard(post, lang)).join("")}</div></div></section>${comingSoonSection(lang)}`;
}

function renderHome(posts) {
  const featured = posts.find((post) => post.featured) || posts[0];
  const featuredEs = localizedPost(featured, "es");
  return page({
    title: localePair(t("es", "homeTitle"), t("en", "homeTitle")),
    description: localePair(t("es", "homeDescription"), t("en", "homeDescription")),
    active: "home",
    body: Object.fromEntries(locales.map((lang) => [lang, renderHomeBody(posts, lang)])),
    bodyClass: "home-page",
    image: featuredEs.image,
    data: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: site.name,
      url: absoluteUrl("/"),
      description: t("es", "homeDescription"),
      author: { "@type": "Person", name: "MDaniel", url: "https://github.com/MDaniel592" }
    }
  });
}

function renderArchiveBody(posts, lang) {
  const topicLinks = topics.map((topic) => topicChip(topic, lang)).join("");
  const countLabel = posts.length === 1 ? t(lang, "archiveCountOne") : t(lang, "archiveCountMany");
  return `<section class="archive-hero"><div class="container"><span class="section-index">${escapeHtml(t(lang, "archiveLabel"))}</span><h1>${escapeHtml(t(lang, "archiveTitle"))}<br><em>${escapeHtml(t(lang, "archiveAccent"))}</em></h1><p>${escapeHtml(t(lang, "archiveDescription"))}</p></div></section><section class="archive-section"><div class="container"><div class="archive-toolbar"><div class="topic-filters"><a class="topic-chip active" data-topic="all" href="${sitePath("/posts.html")}">${escapeHtml(t(lang, "allTopic"))}</a>${topicLinks}</div><span class="archive-count">${posts.length} ${escapeHtml(countLabel)}</span></div><div class="archive-grid">${posts.map((post) => postCard(post, lang, "archive-card")).join("")}</div></div></section>`;
}

function renderArchive(posts) {
  return page({
    title: localePair(t("es", "titleArchive"), t("en", "titleArchive")),
    description: localePair(t("es", "descriptionArchive"), t("en", "descriptionArchive")),
    active: "archive",
    body: Object.fromEntries(locales.map((lang) => [lang, renderArchiveBody(posts, lang)])),
    bodyClass: "archive-page",
    canonicalPath: "/posts.html",
    data: { "@context": "https://schema.org", "@type": "CollectionPage", name: t("es", "titleArchive"), url: absoluteUrl("/posts.html") }
  });
}

function renderPostBody(post, posts, lang) {
  const item = localizedPost(post, lang);
  const related = posts.filter((item) => item.slug !== post.slug && (item.category === post.category || item.tags.some((tag) => post.tags.includes(tag)))).slice(0, 2);
  const relatedFallback = related.length ? related : posts.filter((item) => item.slug !== post.slug).slice(0, 2);
  const contextId = lang === "en" ? "context" : "contexto";
  const stepsId = lang === "en" ? "steps" : "pasos";
  const contextAnchor = `${lang}-${contextId}`;
  const stepsAnchor = `${lang}-${stepsId}`;
  const shareAnchor = `${lang}-share`;
  const articleMarkdown = renderMarkdown(item.body).replace(/ id="([^"]+)"/g, ` id="${lang}-$1"`);
  const body = `<article class="article-page"><div class="container article-container"><div class="article-top"><a class="back-link" href="${sitePath("/posts.html")}">${icon("arrow")} ${escapeHtml(t(lang, "articleBack"))}</a><div class="article-meta"><span>${escapeHtml(item.category)}</span><span class="dot"></span><time datetime="${item.date}">${formatDate(item.date, lang)}</time><span class="dot"></span><span>${escapeHtml(item.readTime)} ${escapeHtml(t(lang, "readUnit"))}</span></div></div><header class="article-header"><h1>${escapeHtml(item.title)}</h1><p class="article-excerpt">${escapeHtml(item.excerpt)}</p><div class="article-author"><div class="author-mark">M</div><div><strong>MDaniel</strong><span>Hardware · RTL · FPGA</span></div><div class="article-tags">${item.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div></div></header><figure class="article-cover"><img src="${sitePath(item.image)}" alt="${escapeHtml(item.imageAlt)}"><figcaption><span>${escapeHtml(t(lang, "figurePrefix"))} ${escapeHtml(item.category.toUpperCase())}</span>${escapeHtml(item.imageAlt)}</figcaption></figure><div class="article-layout"><aside class="article-aside"><span class="aside-label">${escapeHtml(t(lang, "toc"))}</span><nav class="toc"><a href="#${contextAnchor}">${escapeHtml(t(lang, "tocContext"))}</a><a href="#${stepsAnchor}">${escapeHtml(t(lang, "tocSteps"))}</a><a href="#${lang}-checklist">${escapeHtml(t(lang, "tocChecklist"))}</a></nav><a class="share-link" href="#${shareAnchor}">${escapeHtml(t(lang, "share"))} ${icon("arrow")}</a></aside><div class="article-content">${articleMarkdown}<div class="article-end" id="${shareAnchor}"><span class="end-mark">↗</span><div><strong>${escapeHtml(t(lang, "usefulQuestion"))}</strong><span>${escapeHtml(t(lang, "usefulText"))}</span></div></div></div></div></div></article><section class="related-section"><div class="container"><div class="section-heading"><div><span class="section-index">${escapeHtml(t(lang, "relatedIndex"))}</span><h2>${escapeHtml(t(lang, "relatedTitle"))}</h2></div><a class="text-link" href="${sitePath("/posts.html")}">${escapeHtml(t(lang, "viewArchive"))} ${icon("arrow")}</a></div><div class="post-grid related-grid">${relatedFallback.map((relatedPost) => postCard(relatedPost, lang)).join("")}</div></div></section>`;
  return body;
}

function renderPost(post, posts) {
  const postEs = localizedPost(post, "es");
  const postEn = localizedPost(post, "en");
  return page({
    title: localePair(postEs.title, postEn.title),
    description: localePair(postEs.excerpt, postEn.excerpt),
    active: "archive",
    body: Object.fromEntries(locales.map((lang) => [lang, renderPostBody(post, posts, lang)])),
    bodyClass: "post-page",
    canonicalPath: post.url,
    image: postEs.image,
    openGraphType: "article",
    data: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: postEs.title,
      description: postEs.excerpt,
      datePublished: postEs.date,
      author: { "@type": "Person", name: "MDaniel", url: "https://github.com/MDaniel592" },
      mainEntityOfPage: absoluteUrl(post.url),
      image: absoluteUrl(postEs.image),
      keywords: postEs.tags.join(", ")
    }
  });
}

function renderAboutBody(lang) {
  return `<section class="about-hero"><div class="container about-hero-grid"><div><span class="section-index">${escapeHtml(t(lang, "aboutLabel"))}</span><h1>${escapeHtml(t(lang, "aboutTitle"))} <em>${escapeHtml(t(lang, "aboutAccent"))}</em></h1></div><p>${escapeHtml(t(lang, "aboutIntro"))}</p></div></section><section class="about-content"><div class="container about-columns"><div class="about-statement"><span class="big-symbol">∿</span><h2>${escapeHtml(t(lang, "aboutStatement"))}</h2></div><div class="about-copy"><p>${escapeHtml(t(lang, "aboutCopyOne"))}</p><p>${escapeHtml(t(lang, "aboutCopyTwo"))}</p><div class="principles"><div><span>01</span><strong>${escapeHtml(t(lang, "principleOne"))}</strong></div><div><span>02</span><strong>${escapeHtml(t(lang, "principleTwo"))}</strong></div><div><span>03</span><strong>${escapeHtml(t(lang, "principleThree"))}</strong></div></div></div></div></section><section class="about-cta"><div class="container"><p>${escapeHtml(t(lang, "aboutCtaQuestion"))}</p><a class="button button-light" href="https://github.com/MDaniel592" target="_blank" rel="noreferrer">${escapeHtml(t(lang, "visitGithub"))} ${icon("external")}</a></div></section>`;
}

function renderAbout() {
  return page({
    title: localePair(t("es", "titleAbout"), t("en", "titleAbout")),
    description: localePair(t("es", "descriptionAbout"), t("en", "descriptionAbout")),
    active: "",
    body: Object.fromEntries(locales.map((lang) => [lang, renderAboutBody(lang)])),
    bodyClass: "about-page",
    canonicalPath: "/about.html",
    data: { "@context": "https://schema.org", "@type": "AboutPage", name: "Sobre RTLwise", url: absoluteUrl("/about.html") }
  });
}

function render404Body(lang) {
  return `<section class="not-found"><div class="container"><span class="section-index">${escapeHtml(t(lang, "notFoundLabel"))}</span><h1>${escapeHtml(t(lang, "notFoundTitle"))}<br><em>${escapeHtml(t(lang, "notFoundAccent"))}</em></h1><p>${escapeHtml(t(lang, "notFoundCopy"))}</p><a class="button" href="${sitePath("/")}">${escapeHtml(t(lang, "backHome"))} ${icon("arrow")}</a></div></section>`;
}

function render404() {
  return page({
    title: localePair(t("es", "titleNotFound"), t("en", "titleNotFound")),
    description: localePair(t("es", "descriptionNotFound"), t("en", "descriptionNotFound")),
    body: Object.fromEntries(locales.map((lang) => [lang, render404Body(lang)])),
    bodyClass: "not-found-page",
    canonicalPath: null,
    robots: "noindex,nofollow"
  });
}

function toPost(data, filename, body) {
  const slug = data.slug || filename.replace(/\.md$/, "");
  const post = {
    ...data,
    slug,
    title: data.title || slug,
    excerpt: data.excerpt || "Una nota de laboratorio.",
    category: data.category || "Notas",
    date: data.date || "2026-01-01",
    readTime: data.readTime || "5 min",
    image: data.image || "/images/hero-circuit.svg",
    imageAlt: data.imageAlt || data.title || "Ilustración de laboratorio",
    tags: Array.isArray(data.tags) ? data.tags : [],
    featured: String(data.featured).toLowerCase() === "true",
    body,
    url: `/posts/${slug}.html`
  };
  post.topicKeys = topicKeysForPost(post);
  return post;
}

function translatedPost(basePost, data, body) {
  const translated = {
    ...basePost,
    ...data,
    slug: basePost.slug,
    title: data.title || basePost.title,
    excerpt: data.excerpt || basePost.excerpt,
    category: data.category || basePost.category,
    date: data.date || basePost.date,
    readTime: data.readTime || basePost.readTime,
    image: data.image || basePost.image,
    imageAlt: data.imageAlt || basePost.imageAlt,
    tags: Array.isArray(data.tags) ? data.tags : basePost.tags,
    featured: basePost.featured,
    body,
    url: basePost.url,
    topicKeys: basePost.topicKeys
  };
  delete translated.locales;
  return translated;
}

async function loadPosts() {
  const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const source = await readFile(path.join(postsDir, file), "utf8");
    const { data, body } = parseFrontmatter(source);
    const spanish = toPost(data, file, body);
    let english = spanish;
    try {
      const translatedSource = await readFile(path.join(englishPostsDir, file), "utf8");
      const translated = parseFrontmatter(translatedSource);
      english = translatedPost(spanish, translated.data, translated.body);
    } catch {
      // Spanish remains the safe fallback until an English translation exists.
    }
    spanish.locales = { es: { ...spanish }, en: english };
    posts.push(spanish);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function jsonPosts(posts) {
  const publicPost = (post, lang) => {
    const { body, locales: ignored, ...item } = localizedPost(post, lang);
    return { ...item, url: sitePath(item.url), image: sitePath(item.image) };
  };
  return posts.map((post) => ({
    ...publicPost(post, "es"),
    locales: Object.fromEntries(locales.map((lang) => [lang, publicPost(post, lang)]))
  }));
}

function rss(posts) {
  const items = posts.slice(0, 10).map((post) => `<item><title>${escapeHtml(post.title)}</title><link>${escapeHtml(absoluteUrl(post.url))}</link><guid>${escapeHtml(absoluteUrl(post.url))}</guid><pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate><description>${escapeHtml(post.excerpt)}</description></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${site.name}</title><link>${escapeHtml(absoluteUrl("/"))}</link><description>${escapeHtml(site.description)}</description>${items}</channel></rss>`;
}

function sitemap(posts) {
  const routes = ["/", "/posts.html", "/about.html", ...posts.map((post) => post.url)];
  const entries = routes.map((route) => `<url><loc>${escapeHtml(absoluteUrl(route))}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
}

async function build() {
  const posts = await loadPosts();
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  await mkdir(path.join(distDir, "posts"), { recursive: true });
  await cp(path.join(sourceDir, "styles.css"), path.join(distDir, "assets", "styles.css"));
  await cp(path.join(sourceDir, "site.js"), path.join(distDir, "assets", "site.js"));
  await cp(path.join(publicDir, "favicon.svg"), path.join(distDir, "favicon.svg"));
  await cp(path.join(publicDir, "images"), path.join(distDir, "images"), { recursive: true });

  await writeFile(path.join(distDir, "index.html"), renderHome(posts));
  await writeFile(path.join(distDir, "posts.html"), renderArchive(posts));
  await writeFile(path.join(distDir, "about.html"), renderAbout(posts));
  await writeFile(path.join(distDir, "404.html"), render404());
  await writeFile(path.join(distDir, "posts.json"), JSON.stringify(jsonPosts(posts), null, 2));
  await writeFile(path.join(distDir, "feed.xml"), rss(posts));
  await writeFile(path.join(distDir, "sitemap.xml"), sitemap(posts));
  await writeFile(path.join(distDir, "robots.txt"), robots());

  for (const post of posts) {
    await writeFile(path.join(distDir, "posts", `${post.slug}.html`), renderPost(post, posts));
  }

  console.log(`✓ RTLwise generado: ${posts.length} notas en dist/`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
