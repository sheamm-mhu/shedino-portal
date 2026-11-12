/* SHEDINO - pemuat konten.
   Mengambil konten yang diedit lewat panel Admin dari database (Supabase).
   Jika database belum diatur, tabel masih kosong, atau koneksi gagal, situs
   memakai isi contoh di assets/data.js sehingga halaman tidak pernah kosong.
   Memerlukan (berurutan): vendor/supabase.js, config.js, auth.js, data.js */
(function () {
  "use strict";

  /* Hanya izinkan alamat http(s) atau alamat di dalam situs. Menolak javascript:, data:, dan sejenisnya. */
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    if (/^\s*(javascript|data|vbscript|file):/i.test(u)) return "";
    return u;
  }
  window.safeUrl = safeUrl;

  const SETTING_KEYS = ["company", "address", "mapsUrl", "email", "whatsapp", "whatsappLabel", "hours", "credit", "teamPhoto", "heroImage", "heroOverlay", "heroLayout", "heroTitle", "heroLead", "servicesIntro", "aboutP1", "aboutP2"];
  const TONES = ["blue", "teal", "amber", "red", "gray"];

  const mapMedia = r => ({
    id: r.id, tab: r.tab, date: String(r.pub_date).slice(0, 10), category: r.category,
    title: r.title, excerpt: r.excerpt || "", tags: Array.isArray(r.tags) ? r.tags : [],
    image: safeUrl(r.image), fileUrl: safeUrl(r.file_url), videoUrl: safeUrl(r.video_url), body: Array.isArray(r.body) ? r.body : []
  });
  const mapDoc = r => ({
    id: r.id, title: r.title, type: r.doc_type, fmt: String(r.fmt || "PDF").toUpperCase(),
    date: String(r.doc_date).slice(0, 10), url: safeUrl(r.url)
  });
  const mapService = r => ({
    id: r.id, group: r.grp, icon: r.icon, login: !!r.login, featured: !!r.featured,
    title: r.title, desc: r.descr || "", url: safeUrl(r.url), btnLabel: r.btn_label || ""
  });
  const mapGroup = r => ({
    id: r.id, name: r.name, icon: r.icon || "file", tone: TONES.includes(r.tone) ? r.tone : "gray",
    url: safeUrl(r.url), note: r.note || ""
  });
  const mapFaq = r => ({ q: r.q, a: r.a || "" });

  async function load() {
    if (!window.Auth || !Auth.configured) return;
    const c = Auth.client;
    const q = (table, order, asc) => c.from(table).select("*").order(order, { ascending: asc })
      .then(res => res, () => ({ data: null, error: true }));

    const all = Promise.all([
      q("media_posts", "pub_date", false),
      q("site_docs", "doc_date", false),
      q("site_services", "sort_order", true),
      q("site_faq", "sort_order", true),
      q("site_groups", "sort_order", true),
      c.from("site_settings").select("key,value").then(res => res, () => ({ data: null, error: true }))
    ]);
    // Jangan menahan halaman lebih dari 3 detik
    const res = await Promise.race([all, new Promise(r => setTimeout(() => r(null), 3000))]);
    if (!res) return;
    const [media, docs, services, faq, groups, settings] = res;

    if (media && !media.error && media.data && media.data.length) {
      window.MEDIA = media.data.filter(r => r.published !== false).map(mapMedia);
    }
    if (docs && !docs.error && docs.data && docs.data.length) {
      window.DOCS = docs.data.filter(r => r.published !== false).map(mapDoc);
    }
    if (services && !services.error && services.data && services.data.length) {
      window.SERVICES = services.data.map(mapService);
    }
    if (groups && !groups.error && groups.data && groups.data.length) {
      window.GROUPS = groups.data.map(mapGroup);
    }
    if (faq && !faq.error && faq.data && faq.data.length) {
      window.FAQ = faq.data.map(mapFaq);
    }
    if (settings && !settings.error && settings.data) {
      settings.data.forEach(row => {
        if (SETTING_KEYS.includes(row.key) && typeof row.value === "string") {
          let v = row.value;
          if (row.key === "teamPhoto" || row.key === "mapsUrl" || row.key === "heroImage") v = safeUrl(v);
          else if (row.key === "heroLayout") v = v === "terpusat" ? "terpusat" : "standar";
          else if (row.key === "heroOverlay") v = String(Math.min(90, Math.max(20, parseInt(v, 10) || 65)));
          window.CONFIG[row.key] = v;
        } else if (row.key === "mediaTypes" && Array.isArray(row.value) && row.value.length) {
          const seen = new Set();
          const types = row.value.map(t => ({
            id: String((t && t.id) || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
            label: String((t && t.label) || "").trim(),
            lead: String((t && t.lead) || "").trim()
          })).filter(t => t.id && t.label && !seen.has(t.id) && seen.add(t.id));
          if (types.length) window.MEDIA_TYPES = types;
        } else if (row.key === "kplh" && row.value && typeof row.value === "object") {
          const k = row.value, str = v => String(v == null ? "" : v);
          const base = window.KPLH || {};
          window.KPLH = {
            title1: str(k.title1 != null ? k.title1 : base.title1), title2: str(k.title2 != null ? k.title2 : base.title2),
            bulan: str(k.bulan != null ? k.bulan : base.bulan), tahun: str(k.tahun != null ? k.tahun : base.tahun),
            logoText: str(k.logoText != null ? k.logoText : base.logoText),
            rows: Array.isArray(k.rows) ? k.rows.slice(0, 80).map(r => ({ label: str(r && r.label), objective: str(r && r.objective), mtd: str(r && r.mtd), ytd: str(r && r.ytd), ptd: str(r && r.ptd) })) : (base.rows || []),
            infoText: str(k.infoText), infoImage: safeUrl(k.infoImage)
          };
        } else if (row.key === "pillars" && Array.isArray(row.value) && row.value.length) {
          window.CONFIG.pillars = row.value.map(p => ({ title: String((p && p.title) || ""), text: String((p && p.text) || "") })).filter(p => p.title || p.text);
        } else if (row.key === "categories" && Array.isArray(row.value) && row.value.length) {
          window.CATEGORIES = row.value.map(String).filter(Boolean);
        }
      });
    }
  }

  window.contentReady = load().catch(() => { /* tetap pakai data.js */ });
})();
