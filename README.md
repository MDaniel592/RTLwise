# RTLwise

Blog estático, rápido y sin base de datos para publicar notas de hardware, FPGA y RTL escribiendo Markdown.

## Arrancar en local

Necesitas Node.js 18 o superior:

```bash
npm run dev
```

Después abre <http://localhost:4173>. El servidor genera `dist/` al arrancar y sirve el sitio con un servidor HTTP pequeño incluido en el proyecto.

Para generar solo la versión publicable:

```bash
npm run build
```

El resultado está en `dist/`; se puede subir tal cual a GitHub Pages, Netlify, Cloudflare Pages o cualquier hosting de archivos estáticos.

## Publicar en GitHub Pages

El repositorio incluye un workflow en `.github/workflows/pages.yml`. Cada push a `main` genera el sitio con la ruta de proyecto `/RTLwise`, publica el artefacto y lo despliega en:

<https://mdaniel592.github.io/RTLwise/>

El generador añade metadatos `canonical`, Open Graph, Twitter Cards, datos estructurados JSON-LD, `robots.txt`, `sitemap.xml` y RSS. En local mantiene la ruta raíz `http://localhost:4173`.

## Publicar una entrada

1. Crea un archivo `.md` dentro de `content/posts/`.
2. Añade el frontmatter al principio del archivo:

```md
---
title: "Título de la entrada"
slug: titulo-de-la-entrada
excerpt: "Una frase para las tarjetas y el SEO."
category: RTL / FPGA
date: 2026-08-03
readTime: 6 min
image: /images/mi-imagen.svg
imageAlt: "Descripción de la imagen"
tags: [verilog, fpga]
---

## Un subtítulo

Escribe aquí la nota. Se admiten **negritas**, *cursivas*, enlaces, listas,
imágenes y bloques de código cercados con tres backticks.
```

3. Si quieres una imagen local, guárdala en `public/images/` y referencia su ruta como `/images/nombre.svg` o `/images/nombre.webp`.
4. Ejecuta `npm run build` y publica la carpeta `dist/`.

El generador incluye automáticamente la nueva entrada en la portada, el archivo, la búsqueda y el feed RSS.

## Estructura

```text
content/posts/    Entradas Markdown en español
content/posts/en/ Traducciones de las entradas al inglés (mismo slug)
public/images/    Imágenes de las entradas
src/styles.css    Estilos del sitio
src/site.js       Interacciones pequeñas del navegador
scripts/build.mjs Generador Markdown → HTML
dist/             Salida generada (no editar a mano)
```

El sitio detecta el idioma preferido del navegador entre español e inglés. El selector `ES / EN` del encabezado permite cambiarlo y guarda la elección en el navegador para las siguientes visitas.
