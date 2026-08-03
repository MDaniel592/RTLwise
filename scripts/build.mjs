import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const postsDir = path.join(root, "content", "posts");
const publicDir = path.join(root, "public");
const sourceDir = path.join(root, "src");
const distDir = path.join(root, "dist");

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

function formatDate(date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" })
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
  return `<a class="brand" href="${sitePath("/")}" aria-label="RTLwise, inicio"><span class="brand-mark"><i></i><i></i><i></i></span><span>RTL<span class="brand-accent">wise</span></span></a>`;
}

function header(active = "home") {
  const links = [
    ["home", "Inicio", "/"],
    ["archive", "Notas", "/posts.html"]
  ];
  return `<header class="site-header"><div class="container header-inner">${logo()}<nav class="main-nav" id="main-nav" aria-label="Navegación principal">${links.map(([key, label, href]) => `<a class="${active === key ? "active" : ""}" href="${sitePath(href)}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav><div class="header-actions"><button class="icon-button search-trigger" type="button" aria-label="Buscar" aria-controls="search-dialog">${icon("search")}</button><a class="header-cta" href="${sitePath("/about.html")}">Sobre el proyecto ${icon("arrow")}</a><button class="icon-button menu-trigger" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="main-nav">${icon("menu")}</button></div></div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-top"><div><div class="footer-brand">${logo()}</div><p>Ideas prácticas de MDaniel para diseñar, depurar y entender hardware digital.</p></div><div class="footer-links"><div><span class="footer-label">Explora</span><a href="${sitePath("/posts.html")}">Todas las notas</a><a href="${sitePath("/posts.html?topic=Hardware")}">Hardware</a><a href="${sitePath("/posts.html?topic=RTL%20%2F%20FPGA")}">RTL / FPGA</a></div><div><span class="footer-label">Conecta</span><a href="https://github.com/MDaniel592" target="_blank" rel="noreferrer">GitHub / MDaniel592 ${icon("external")}</a><a href="${sitePath("/feed.xml")}">RSS ${icon("rss")}</a></div></div></div><div class="container footer-bottom"><span>© 2026 MDaniel · RTLwise</span><span>Hecho con curiosidad y un osciloscopio.</span></div></footer>`;
}

function structuredData(data) {
  if (!data) return "";
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function page({ title, description = site.description, active = "", body, bodyClass = "", canonicalPath = "/", image = "/favicon.svg", robots = "index,follow", openGraphType = "website", data = null }) {
  const canonical = canonicalPath === null ? "" : absoluteUrl(canonicalPath);
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const socialImage = absoluteUrl(image);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="site-base-path" content="${escapeHtml(site.basePath)}"><meta name="description" content="${escapeHtml(description)}"><meta name="author" content="MDaniel"><meta name="robots" content="${robots}"><meta name="theme-color" content="#1b211d">${canonicalTag}<meta property="og:type" content="${openGraphType}"><meta property="og:site_name" content="${site.name}"><meta property="og:locale" content="es_ES"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical || absoluteUrl("/"))}"><meta property="og:image" content="${escapeHtml(socialImage)}"><meta property="og:image:alt" content="${escapeHtml(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(socialImage)}"><title>${escapeHtml(title)} · ${site.name}</title><link rel="icon" href="${sitePath("/favicon.svg")}" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="RSS de RTLwise" href="${sitePath("/feed.xml")}"><link rel="stylesheet" href="${sitePath("/assets/styles.css")}">${structuredData(data)}</head><body class="${bodyClass}">${header(active)}<main>${body}</main>${footer()}<div class="search-dialog" id="search-dialog" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="search-title"><div class="search-panel"><div class="search-panel-head"><span id="search-title">Buscar en RTLwise</span><button class="icon-button search-close" type="button" aria-label="Cerrar búsqueda">${icon("close")}</button></div><label class="search-input-wrap">${icon("search")}<input id="search-input" type="search" placeholder="Prueba: UART, alimentación…" autocomplete="off"></label><div class="search-results" id="search-results"><p class="search-empty">Escribe para encontrar una nota.</p></div></div></div><script src="${sitePath("/assets/site.js")}" defer></script></body></html>`;
}

function postCard(post, variant = "") {
  return `<article class="post-card ${variant}" data-category="${escapeHtml(post.category)}" data-tags="${escapeHtml(post.tags.join(" "))}"><a class="card-image" href="${sitePath(post.url)}"><img src="${sitePath(post.image)}" alt="${escapeHtml(post.imageAlt)}" loading="lazy"><span class="card-arrow">${icon("arrow")}</span></a><div class="card-body"><div class="post-meta"><span>${escapeHtml(post.category)}</span><span class="dot"></span><time datetime="${post.date}">${formatDate(post.date)}</time></div><h3><a href="${sitePath(post.url)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt)}</p><a class="text-link" href="${sitePath(post.url)}">Leer la nota ${icon("arrow")}</a></div></article>`;
}

function topicChip(topic, active = false) {
  return `<a class="topic-chip ${active ? "active" : ""}" href="${sitePath(`/posts.html?topic=${encodeURIComponent(topic)}`)}">${escapeHtml(topic)}</a>`;
}

function comingSoonSection() {
  return `<section class="newsletter-section"><div class="container newsletter-box"><div class="newsletter-symbol">↗</div><div><span class="section-index">UNA SEÑAL A LA SEMANA</span><h2>Hardware sin ruido<br><em>en tu bandeja.</em></h2></div><form class="newsletter-form" aria-label="Newsletter próximamente"><label class="sr-only" for="newsletter-email">Tu email</label><input id="newsletter-email" type="email" placeholder="tu@email.com" disabled><button type="submit" disabled>Apuntarme ${icon("arrow")}</button><p class="form-note">La newsletter estará disponible próximamente.</p></form><span class="newsletter-watermark" aria-hidden="true">PRÓXIMAMENTE</span></div></section>`;
}

function renderHome(posts) {
  const featured = posts.find((post) => post.featured) || posts[0];
  const latest = posts.filter((post) => post.slug !== featured.slug).slice(0, 4);
  const topics = ["RTL / FPGA", "Hardware", "Verilog", "Instrumentación"];
  const body = `<section class="hero-section"><div class="container"><div class="hero-kicker"><span class="live-dot"></span> Cuaderno de laboratorio <span class="hero-line"></span> MDaniel · 01 / ${String(posts.length).padStart(2, "0")}</div><div class="hero-card"><div class="hero-copy"><div class="eyebrow">${escapeHtml(featured.category)} <span>·</span> ${escapeHtml(featured.readTime)}</div><h1>${escapeHtml(featured.title)}</h1><p>${escapeHtml(featured.excerpt)}</p><div class="hero-details"><div class="author-mark">M</div><div><strong>Por MDaniel</strong><span>Publicado el ${formatDate(featured.date)} · Hardware / RTL</span></div><a class="round-link" href="${sitePath(featured.url)}" aria-label="Leer ${escapeHtml(featured.title)}">${icon("arrow")}</a></div></div><a class="hero-image" href="${sitePath(featured.url)}"><img src="${sitePath(featured.image)}" alt="${escapeHtml(featured.imageAlt)}"><span class="image-note">FIG. 01 <span>señal limpia, diseño claro</span></span></a></div></div></section><section class="intro-section"><div class="container intro-grid"><div><span class="section-index">01 — QUÉ ENCONTRARÁS</span><h2>Menos teoría de escaparate.<br><em>Más cosas que funcionan.</em></h2></div><div class="intro-copy"><p>RTLwise es un lugar para entender el hardware desde la mesa de trabajo: señales, placas, código y las pequeñas decisiones que hacen que un diseño sea estable.</p><a class="text-link dark-link" href="${sitePath("/about.html")}">Conoce el proyecto ${icon("arrow")}</a></div></div></section><section class="topics-section"><div class="container"><div class="section-heading"><div><span class="section-index">02 — FILTRA POR TEMA</span><h2>Elige tu siguiente experimento.</h2></div><a class="text-link" href="${sitePath("/posts.html")}">Ver todas las notas ${icon("arrow")}</a></div><div class="topics-list">${topics.map((topic) => topicChip(topic)).join("")}</div></div></section><section class="latest-section"><div class="container"><div class="section-heading"><div><span class="section-index">03 — RECIÉN SALIDO DEL LAB</span><h2>Últimas notas</h2></div><span class="section-aside">Notas cortas, esquemas largos.</span></div><div class="post-grid">${latest.map((post) => postCard(post)).join("")}</div></div></section>${comingSoonSection()}`;
  return page({
    title: "Hardware y RTL, explicado sin ruido",
    description: site.description,
    active: "home",
    body,
    bodyClass: "home-page",
    image: featured.image,
    data: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: site.name,
      url: absoluteUrl("/"),
      description: site.description,
      author: { "@type": "Person", name: "MDaniel", url: "https://github.com/MDaniel592" }
    }
  });
}

function renderArchive(posts) {
  const body = `<section class="archive-hero"><div class="container"><span class="section-index">ARCHIVO RTLWISE</span><h1>Todas las notas<br><em>del laboratorio.</em></h1><p>Una colección creciente de apuntes sobre hardware, RTL, FPGA e instrumentación práctica.</p></div></section><section class="archive-section"><div class="container"><div class="archive-toolbar"><div class="topic-filters"><a class="topic-chip active" href="${sitePath("/posts.html")}">Todo</a>${["RTL / FPGA", "Hardware", "Verilog", "Instrumentación"].map((topic) => topicChip(topic)).join("")}</div><span class="archive-count">${posts.length} notas publicadas</span></div><div class="archive-grid">${posts.map((post) => postCard(post, "archive-card")).join("")}</div></div></section>`;
  return page({
    title: "Todas las notas",
    description: "Archivo de notas sobre hardware, RTL y FPGA.",
    active: "archive",
    body,
    bodyClass: "archive-page",
    canonicalPath: "/posts.html",
    data: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Todas las notas", url: absoluteUrl("/posts.html") }
  });
}

function renderPost(post, posts) {
  const related = posts.filter((item) => item.slug !== post.slug && (item.category === post.category || item.tags.some((tag) => post.tags.includes(tag)))).slice(0, 2);
  const relatedFallback = related.length ? related : posts.filter((item) => item.slug !== post.slug).slice(0, 2);
  const body = `<article class="article-page"><div class="container article-container"><div class="article-top"><a class="back-link" href="${sitePath("/posts.html")}">${icon("arrow")} Volver a las notas</a><div class="article-meta"><span>${escapeHtml(post.category)}</span><span class="dot"></span><time datetime="${post.date}">${formatDate(post.date)}</time><span class="dot"></span><span>${escapeHtml(post.readTime)} de lectura</span></div></div><header class="article-header"><h1>${escapeHtml(post.title)}</h1><p class="article-excerpt">${escapeHtml(post.excerpt)}</p><div class="article-author"><div class="author-mark">M</div><div><strong>MDaniel</strong><span>Hardware · RTL · FPGA</span></div><div class="article-tags">${post.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div></div></header><figure class="article-cover"><img src="${sitePath(post.image)}" alt="${escapeHtml(post.imageAlt)}"><figcaption><span>FIG. / ${post.category.toUpperCase()}</span>${escapeHtml(post.imageAlt)}</figcaption></figure><div class="article-layout"><aside class="article-aside"><span class="aside-label">En esta nota</span><nav class="toc"><a href="#contexto">Contexto</a><a href="#pasos">Pasos</a><a href="#checklist">Checklist</a></nav><a class="share-link" href="#share">Compartir ${icon("arrow")}</a></aside><div class="article-content">${renderMarkdown(post.body)}<div class="article-end" id="share"><span class="end-mark">↗</span><div><strong>¿Te ha servido?</strong><span>Guárdalo para la próxima sesión de laboratorio.</span></div></div></div></div></div></article><section class="related-section"><div class="container"><div class="section-heading"><div><span class="section-index">SIGUE EXPLORANDO</span><h2>Más señales útiles</h2></div><a class="text-link" href="${sitePath("/posts.html")}">Ver archivo ${icon("arrow")}</a></div><div class="post-grid related-grid">${relatedFallback.map((item) => postCard(item)).join("")}</div></div></section>`;
  return page({
    title: post.title,
    description: post.excerpt,
    active: "archive",
    body,
    bodyClass: "post-page",
    canonicalPath: post.url,
    image: post.image,
    openGraphType: "article",
    data: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.date,
      author: { "@type": "Person", name: "MDaniel", url: "https://github.com/MDaniel592" },
      mainEntityOfPage: absoluteUrl(post.url),
      image: absoluteUrl(post.image),
      keywords: post.tags.join(", ")
    }
  });
}

function renderAbout() {
  const body = `<section class="about-hero"><div class="container about-hero-grid"><div><span class="section-index">SOBRE RTLWISE</span><h1>Diseñar mejor empieza por <em>mirar mejor.</em></h1></div><p>Un blog para quienes disfrutan entendiendo qué pasa entre el pin, la señal y el código.</p></div></section><section class="about-content"><div class="container about-columns"><div class="about-statement"><span class="big-symbol">∿</span><h2>La ingeniería también se aprende siguiendo una pista.</h2></div><div class="about-copy"><p>RTLwise reúne notas pequeñas y concretas sobre hardware digital. La idea es documentar el camino completo: elegir un componente, dibujar un esquema, escribir RTL, medir una señal y volver a intentarlo.</p><p>No hace falta tener un laboratorio perfecto. Hace falta una pregunta buena, una placa a mano y la paciencia de mirar los detalles.</p><div class="principles"><div><span>01</span><strong>Claro antes que brillante</strong></div><div><span>02</span><strong>Medir antes de adivinar</strong></div><div><span>03</span><strong>Compartir lo que falla</strong></div></div></div></div></section><section class="about-cta"><div class="container"><p>¿Tienes una señal que seguir?</p><a class="button button-light" href="https://github.com/MDaniel592" target="_blank" rel="noreferrer">Visita GitHub ${icon("external")}</a></div></section>`;
  return page({
    title: "Sobre el proyecto",
    description: "Conoce la idea detrás de RTLwise.",
    active: "",
    body,
    bodyClass: "about-page",
    canonicalPath: "/about.html",
    data: { "@context": "https://schema.org", "@type": "AboutPage", name: "Sobre RTLwise", url: absoluteUrl("/about.html") }
  });
}

function render404() {
  const body = `<section class="not-found"><div class="container"><span class="section-index">ERROR 404</span><h1>Esta señal<br><em>se ha perdido.</em></h1><p>La página que buscas no está en este bus. Vuelve al inicio y seguimos desde ahí.</p><a class="button" href="${sitePath("/")}">Volver a la portada ${icon("arrow")}</a></div></section>`;
  return page({ title: "Página no encontrada", description: "La página solicitada no existe.", body, bodyClass: "not-found-page", canonicalPath: null, robots: "noindex,nofollow" });
}

function toPost(data, filename, body) {
  const slug = data.slug || filename.replace(/\.md$/, "");
  return {
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
}

async function loadPosts() {
  const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const source = await readFile(path.join(postsDir, file), "utf8");
    const { data, body } = parseFrontmatter(source);
    posts.push(toPost(data, file, body));
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function jsonPosts(posts) {
  return posts.map(({ body, ...post }) => ({ ...post, url: sitePath(post.url), image: sitePath(post.image) }));
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
