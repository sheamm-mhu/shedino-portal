"use strict";
/*
  Tautan pratinjau untuk dibagikan: https://situs-anda/s/<id-artikel>

  Mesin pratinjau WhatsApp, Facebook, Telegram, dan sejenisnya tidak menjalankan JavaScript, sehingga halaman artikel
  (yang dirender oleh JavaScript) selalu tampak sama bagi mereka. Fungsi ini membaca artikelnya dari Supabase lalu
  mengirim halaman HTML kecil berisi tag Open Graph (judul, ringkasan, gambar) KHUSUS untuk mesin pratinjau.
  Pengunjung biasa langsung dialihkan ke halaman artikel yang sebenarnya.
  Hanya membaca artikel yang sudah tayang, memakai kunci publik (anon) yang sama dengan situs.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const BOT = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|linkedinbot|slackbot|slack-imgproxy|discordbot|skypeuripreview|pinterest|embedly|vkshare|redditbot|applebot|googlebot|bingbot|bingpreview|signal|viber|kakaotalk|snapchat|iframely|mastodon|bsky|cardyb|opengraph|preview|crawler|spider|\bbot\b/i;

const ROOT = path.join(__dirname, "..");

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function clip(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;
}

function readConfig() {
  let url = process.env.SUPABASE_URL || "", key = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    try {
      const s = fs.readFileSync(path.join(ROOT, "public", "config.js"), "utf8");
      url = url || ((s.match(/SUPABASE_URL\s*:\s*["']([^"']+)["']/) || [])[1] || "");
      key = key || ((s.match(/SUPABASE_ANON_KEY\s*:\s*["']([^"']+)["']/) || [])[1] || "");
    } catch (e) { /* tanpa config.js: pakai data bawaan saja */ }
  }
  return { url: url.replace(/\/+$/, ""), key };
}

let defaultsCache = null;
function readDefaults() {
  if (defaultsCache) return defaultsCache;
  try {
    const code = fs.readFileSync(path.join(ROOT, "public", "assets", "data.js"), "utf8");
    const sandbox = { window: {}, console };
    vm.runInNewContext(code, sandbox, { timeout: 1000 });
    defaultsCache = sandbox.window || {};
  } catch (e) { defaultsCache = {}; }
  return defaultsCache;
}

async function fromDb(id) {
  const cfg = readConfig();
  if (!cfg.url || !cfg.key) return null;
  const endpoint = `${cfg.url}/rest/v1/media_posts?select=id,title,excerpt,image,video_url,pub_date,tab,category,tags&id=eq.${encodeURIComponent(id)}&published=eq.true&limit=1`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(endpoint, { headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key }, signal: ctl.signal });
    if (!r.ok) return null;
    const rows = await r.json();
    const x = Array.isArray(rows) && rows[0];
    return x ? { title: x.title, excerpt: x.excerpt, image: x.image, date: x.pub_date, tags: x.tags } : null;
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

function fromDefaults(id) {
  const list = readDefaults().MEDIA;
  const x = Array.isArray(list) && list.find(m => m && m.id === id);
  return x ? { title: x.title, excerpt: x.excerpt, image: x.image, date: x.date, tags: x.tags } : null;
}

function absUrl(origin, u) {
  u = String(u || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u.replace(/ /g, "%20");
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";          // javascript:, data:, dan sejenisnya
  return origin + "/" + encodeURI(u.replace(/^\/+/, ""));
}

function page(o) {
  const t = esc(o.title), d = esc(o.description), img = esc(o.image), url = esc(o.url);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="robots" content="noindex">
<meta name="description" content="${d}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(o.siteName)}">
<meta property="og:locale" content="id_ID">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
${o.image ? `<meta property="og:image" content="${img}">\n<meta property="og:image:secure_url" content="${img}">\n<meta property="og:image:alt" content="${t}">` : ""}
${o.published ? `<meta property="article:published_time" content="${esc(o.published)}">` : ""}
<meta name="twitter:card" content="${o.image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${o.image ? `<meta name="twitter:image" content="${img}">` : ""}
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${esc(o.articleUrl)}">Baca selengkapnya</a></p>
</body>
</html>`;
}

function redirect(res, to) {
  res.statusCode = 302;
  res.setHeader("Location", to);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const id = String(Array.isArray(q.id) ? q.id[0] : (q.id || "")).trim();
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id)) return redirect(res, "/");

  const articlePath = "/artikel?id=" + encodeURIComponent(id);
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  if (!BOT.test(ua)) return redirect(res, articlePath);   // pengunjung biasa: langsung ke artikel

  const proto = String((req.headers && req.headers["x-forwarded-proto"]) || "https").split(",")[0].trim();
  let host = String((req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "").split(",")[0].trim();
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) host = process.env.VERCEL_URL || "localhost";
  const origin = (proto === "http" ? "http" : "https") + "://" + host;

  const cfg = readDefaults().CONFIG || {};
  const siteName = cfg.name || "SHEDINO";
  const m = (await fromDb(id)) || fromDefaults(id);

  let out;
  if (m && m.title) {
    out = {
      title: clip(m.title, 150),
      description: clip(m.excerpt, 200) || clip(cfg.tagline, 200) || siteName,
      image: absUrl(origin, m.image) || origin + "/assets/logo-512.png",
      url: origin + "/s/" + encodeURIComponent(id),
      articleUrl: origin + articlePath,
      siteName,
      published: /^\d{4}-\d{2}-\d{2}/.test(String(m.date || "")) ? String(m.date).slice(0, 10) : ""
    };
  } else {
    out = {
      title: siteName + (cfg.tagline ? " | " + cfg.tagline : ""),
      description: clip(cfg.tagline, 200) || siteName,
      image: origin + "/assets/logo-512.png",
      url: origin + "/s/" + encodeURIComponent(id),
      articleUrl: origin + articlePath,
      siteName,
      published: ""
    };
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(page(out));
};
