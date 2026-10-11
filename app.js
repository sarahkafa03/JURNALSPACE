"use strict";
const $ = (id) => document.getElementById(id);
const STOP = new Set(
  "yang dan di ke dari untuk pada dengan ini itu adalah juga dalam atau akan oleh sebagai karena tidak ada dapat telah sudah lebih serta saat bagi para agar jika hanya masih sebuah suatu mereka kami kita saya anda dia ia nya lah kah pun bahwa tetapi namun sehingga antara setelah sebelum hingga seperti secara yaitu yakni tersebut dua tiga atau the of and to in is a for on with".split(
    " ",
  ),
);
// Stopword tambahan (kata fungsi umum) agar tidak ikut di-stem/diindeks
"terhadap melalui kepada tentang bisa harus setiap lain lainnya banyak sangat semua beberapa ialah merupakan berbagai sedangkan ketika dimana mana apa bagaimana dalam telah bukan belum sudah dengan tanpa sampai lalu kemudian maka jadi sebab oleh pula bila ini itu hal dll dsb dst yg dgn utk dr pd this that are was were be by as at from it its an has have not can which their these also than into we our been may such other more each both between during using used use".split(" ").forEach((w) => STOP.add(w));
const S = { docs: [], idx: null, rows: [], head: [], idxCols: {} };

/* ---------- Kamus Kata Dasar ---------- */
const KATA_DASAR = new Set();


/* ---------- Status UI ---------- */
// Teks status di beranda hanya ditampilkan bila berisi pesan error
function setHeroStat(html) {
  const el = $("heroStat");
  if (!el) return;
  el.innerHTML = html;
  el.classList.toggle("show", html.includes('class="err"'));
}
const nextPaint = () => new Promise((r) => setTimeout(r, 30));

/* Kamus kata dasar: tahan terhadap UTF-16, BOM, pemisah koma/spasi, dan cache lama */
async function loadKamus() {
  try {
    log("Sistem", "Sedang memuat kamus kata dasar Sastrawi...");
    const res = await fetch("kata-dasar.txt", { cache: "no-cache" });
    if (!res.ok) {
      log("Warning", `kata-dasar.txt tidak ditemukan (HTTP ${res.status}). Stemming TIDAK aktif.`);
      return;
    }
    const buf = await res.arrayBuffer(),
      u = new Uint8Array(buf);
    let enc = "utf-8";
    if (u[0] === 0xff && u[1] === 0xfe) enc = "utf-16le";
    else if (u[0] === 0xfe && u[1] === 0xff) enc = "utf-16be";
    const text = new TextDecoder(enc).decode(buf).replace(/^\uFEFF/, "");
    if (/^\s*</.test(text)) {
      log("Warning", "kata-dasar.txt berisi HTML, bukan daftar kata. Stemming TIDAK aktif.");
      return;
    }
    text.split(/[\s,;"'\[\]]+/).forEach((k) => {
      k = k.trim().toLowerCase();
      if (k) KATA_DASAR.add(k);
    });
    if (KATA_DASAR.size < 1000)
      log("Warning", `Kamus hanya berisi ${KATA_DASAR.size} kata (Sastrawi ±30.000). Periksa isi kata-dasar.txt.`);
    else log("Sistem", `Berhasil memuat ${KATA_DASAR.size} kata dasar (encoding ${enc}).`);
    const uji = ["pendekatan", "mengajar", "kesehatan"].map((w) => `${w}→${stem(w)}`).join(", ");
    log("Sistem", `Uji stemming: ${uji}`);
  } catch (error) {
    log("Warning", "Gagal memuat kata-dasar.txt: " + error.message);
  }
}

async function initApp() {
  // 1. Kamus kata dasar (Sastrawi)
  await loadKamus();

  // 2. Dataset: data.csv terhubung langsung ke aplikasi
  try {
    setHeroStat("Memuat dataset…");
    log("Sistem", "Membaca dataset data.csv...");
    const resCSV = await fetch("data.csv", { cache: "no-cache" });
    if (!resCSV.ok) throw new Error("data.csv tidak ditemukan");
    const text = await resCSV.text();
    setHeroStat("Mengindeks dokumen…");
    await nextPaint(); // beri kesempatan browser menampilkan status sebelum indeks berat
    if (!loadText(text)) throw new Error("Isi data.csv kosong atau tidak terbaca");
  } catch (error) {
    log("Error", `${error.message}. Pastikan data.csv ada di folder yang sama dan aplikasi dijalankan lewat localhost/server.`);
    if ($("stat")) $("stat").innerHTML = '<span class="err">Gagal memuat dataset.</span>';
    setHeroStat('<span class="err">Dataset gagal dimuat. Pastikan <b>data.csv</b> ada di folder yang sama dan jalankan lewat localhost/server.</span>');
  }
}
window.addEventListener("DOMContentLoaded", initApp);

/* ---------- Log proses ---------- */
const LOG = [];
function log(tag, msg) {
  const d = new Date(),
    t =
      d.toTimeString().slice(0, 8) +
      "." +
      String(d.getMilliseconds()).padStart(3, "0");
  LOG.push(`[${t}] ${tag}: ${msg}`);
  const el = $("logbody");
  if (el) {
    el.textContent = LOG.join("\n");
    el.scrollTop = el.scrollHeight;
  }
}

/* ---------- Pra-proses ---------- */
function caseFold(t) {
  return t.toLowerCase();
}
function clean(t) {
  return t
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenize(t) {
  return t ? t.split(" ") : [];
}

/* ---------- Algoritma Stemming Sastrawi (Ultimate & Bulletproof) ---------- */
function stem(w) {
  if (w.length <= 3 || KATA_DASAR.has(w)) return w;

  let current = w;
  let original = w;

  // 1. Hapus Partikel (-lah, -kah, -tah, -pun)
  let p1 = current.replace(/(lah|kah|tah|pun)$/, "");
  if (p1 !== current) {
    if (KATA_DASAR.has(p1)) return p1;
    current = p1;
  }

  // 2. Hapus Pronoun (-ku, -mu, -nya)
  let p2 = current.replace(/(ku|mu|nya)$/, "");
  if (p2 !== current) {
    if (KATA_DASAR.has(p2)) return p2;
    current = p2;
  }

  // 3. Mesin Evaluasi Awalan Berbasis Kandidat (Disambiguasi)
  const execPrefix = (str) => {
    if (KATA_DASAR.has(str)) return str;

    if (/^meny([a-z].*)/.test(str) && KATA_DASAR.has(str.replace(/^me/, "")))
      return str.replace(/^me/, "");

    const rules = [
      // MENG- & PENG-
      { re: /^(m|p)eng([aiueo].*)/, cands: ["$2", "k$2"] },
      { re: /^(m|p)eng([ghqk].*)/, cands: ["$2"] },
      // MENY- & PENY-
      { re: /^(m|p)eny([aiueo].*)/, cands: ["s$2"] },
      // MEN- & PEN-
      { re: /^(m|p)en([aiueo].*)/, cands: ["n$2", "t$2"] },
      { re: /^(m|p)en([cdjtysz].*)/, cands: ["$2"] },
      // MEM- & PEM-
      { re: /^(m|p)em([aiueo].*)/, cands: ["m$2", "p$2"] },
      { re: /^(m|p)em([bfpv].*)/, cands: ["$2"] },
      // BER-, TER-, PER-
      { re: /^(ber|ter|per)([aiueo].*)/, cands: ["$2", "r$2"] },
      { re: /^(ber|ter|per)(.*)/, cands: ["$2"] },
      // BEL-, PEL-, TEL-
      { re: /^(bel|pel|tel)([aiueo].*)/, cands: ["$2"] },
      // Awalan standar lainnya
      { re: /^(me|pe|di|ke|se|be|te)(.*)/, cands: ["$2"] },
    ];

    for (let rule of rules) {
      let match = str.match(rule.re);
      if (match) {
        for (let cand of rule.cands) {
          // FIX: ganti placeholder $1/$2 dengan hasil tangkapan regex
          cand = cand.replace(/\$(\d)/g, (_, n) => match[+n] || "");
          if (KATA_DASAR.has(cand)) return cand;
          let nested = execPrefix(cand);
          if (nested) return nested;
        }
      }
    }
    return null;
  };

  // 4. Proses Kombinasi (Awalan & Akhiran)
  // FIX: coba tiap akhiran (-kan, -an, -i) berurutan, bukan hanya yang cocok pertama
  for (const suffix of ["kan", "an", "i"]) {
    if (!current.endsWith(suffix)) continue;
    const withoutSuffix = current.slice(0, -suffix.length);

    if (current.startsWith("be") && suffix === "i") return original;

    if (KATA_DASAR.has(withoutSuffix)) return withoutSuffix;

    const checkWithSuffixRemoved = execPrefix(withoutSuffix);
    if (checkWithSuffixRemoved) return checkWithSuffixRemoved;
  }

  let checkPrefixOnly = execPrefix(current);
  if (checkPrefixOnly) return checkPrefixOnly;

  return original;
}

const STEM_CACHE = new Map();
function stemCached(w) {
  let r = STEM_CACHE.get(w);
  if (r === undefined) { r = stem(w); STEM_CACHE.set(w, r); }
  return r;
}

function steps(text, o) {
  const a = caseFold(text),
    b = clean(a),
    c = tokenize(b),
    d = o.stop
      ? c.filter((w) => !STOP.has(w) && w.length > 1)
      : c.filter((w) => w.length > 1),
    e = o.stem ? d.map(stemCached) : d;
  return { a, b, c, d, e };
}
// Stemming & stopword selalu aktif (bagian dari alur pra-proses)
const opts = () => ({ stem: true, stop: true });

function parseCSV(s) {
  const rows = [];
  let r = [],
    f = "",
    q = false;
  const d =
    (s.split("\n")[0].match(/;/g) || []).length >
    (s.split("\n")[0].match(/,/g) || []).length
      ? ";"
      : ",";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c == '"') {
        if (s[i + 1] == '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c == '"') q = true;
    else if (c === d) {
      r.push(f);
      f = "";
    } else if (c == "\n" || c == "\r") {
      if (c == "\r" && s[i + 1] == "\n") i++;
      r.push(f);
      f = "";
      if (r.some((x) => x.trim())) rows.push(r);
      r = [];
    } else f += c;
  }
  if (f || r.length) {
    r.push(f);
    rows.push(r);
  }
  return rows;
}

function loadText(t) {
  const rows = parseCSV(t.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    if ($("stat")) $("stat").innerHTML = '<span class="err">CSV kosong atau tidak terbaca.</span>';
    return false;
  }
  S.head = rows[0].map((h) => h.trim());
  S.rows = rows.slice(1);
  log("CSV", `${S.rows.length} baris data dibaca, ${S.head.length} kolom: ${S.head.join(", ")}`);

  const find = (re) => S.head.findIndex((h) => re.test(h.toLowerCase()));
  let ti = find(/judul|title|nama/);
  let bi = find(/isi|konten|content|text|teks|abstrak|abstract|deskripsi|body/);
  let topi = find(/topik|kategori/);
  let peni = find(/penulis|author/);
  let urli = find(/url|link/);

  if (ti < 0) ti = 0;
  if (bi < 0) bi = Math.min(1, S.head.length - 1);
  S.idxCols = { ti, bi, topi, peni, urli };

  build();
  return true;
}

/* ---------- Indeks & VSM ---------- */
function build() {
  const t0 = performance.now(),
    o = opts();
  const { ti, bi, topi, peni, urli } = S.idxCols;

  const docs = S.rows.map((r, i) => {
    const topik = topi >= 0 && r[topi] && r[topi].trim() ? r[topi].trim() : "Umum";
    return {
      id: i + 1,
      title: (r[ti] || "Dokumen " + (i + 1)).trim(),
      body: (r[bi] || "").trim(),
      topik,
      kat: topik.toLowerCase(), // kunci pengelompokan kategori
      penulis: peni >= 0 && r[peni] && r[peni].trim() ? r[peni].trim() : "Anonim",
      url: urli >= 0 && r[urli] ? r[urli].trim() : "",
    };
  });

  const N = docs.length,
    df = new Map(),
    inv = new Map();
  log("Indeks", `Mulai mengindeks ${N} dokumen...`);

  docs.forEach((d) => {
    d.tokens = steps(d.title + " " + d.body, o).e;
    const tf = new Map();
    d.tokens.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    d.tf = tf;
    tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1));
  });

  const idf = new Map();
  df.forEach((n, w) => idf.set(w, Math.log10(N / n)));

  docs.forEach((d) => {
    let s = 0;
    d.w = new Map();
    d.tf.forEach((f, w) => {
      const x = (1 + Math.log10(f)) * idf.get(w);
      d.w.set(w, x);
      s += x * x;
      if (!inv.has(w)) inv.set(w, []);
      inv.get(w).push(d);
    });
    d.norm = Math.sqrt(s);
  });
  S.docs = docs;
  S.idx = { N, df, idf, inv, o };

  const ms = Math.round(performance.now() - t0);
  const nCat = new Set(docs.map((d) => d.kat)).size;
  log("Indeks", `Inverted index selesai: ${inv.size} term unik (${ms} ms)`);

  if ($("stat"))
    $("stat").innerHTML = `<span>Dokumen <b>${NF.format(N)}</b></span><span>Term unik <b>${NF.format(df.size)}</b></span><span>Kategori <b>${nCat}</b></span><span>Waktu indeks <b>${ms} ms</b></span>${KATA_DASAR.size ? `<span>Kamus <b>${NF.format(KATA_DASAR.size)}</b> kata</span>` : `<span class="err">Kamus belum termuat, stemming tidak aktif</span>`}`;
  setHeroStat(`Mencari di <b>${NF.format(N)}</b> dokumen`);

  if ($("q") && $("go")) {
    $("q").disabled = $("go").disabled = false;
    $("q").placeholder = "Masukkan kata kunci pencarian…";
    if (!cur) $("q").focus();
  }
  log("Sistem", "Mesin pencari VSM & TF-IDF siap digunakan.");
}

/* ---------- Pencarian (tanpa filter kategori; kategori disaring sesudahnya) ---------- */
function search(text) {
  const I = S.idx,
    o = I.o,
    p = steps(text, o),
    qt = new Map();
  p.e.forEach((w) => qt.set(w, (qt.get(w) || 0) + 1));
  const qw = new Map();
  let qs = 0;
  qt.forEach((f, w) => {
    if (I.idf.has(w)) {
      const x = (1 + Math.log10(f)) * I.idf.get(w);
      qw.set(w, x);
      qs += x * x;
    }
  });
  const qn = Math.sqrt(qs),
    acc = new Map();
  qw.forEach((x, w) =>
    I.inv.get(w).forEach((d) => {
      acc.set(d, (acc.get(d) || 0) + x * d.w.get(w));
    }),
  );
  const res = [];
  acc.forEach((dot, d) => {
    const s = dot / (qn * d.norm || 1);
    if (s > 0) res.push({ d, s });
  });
  res.sort((a, b) => b.s - a.s || a.d.id - b.d.id);
  return {
    p,
    qw,
    qt,
    res,
    unknown: [...qt.keys()].filter((w) => !I.idf.has(w)),
  };
}

/* ---------- Util tampilan ---------- */
const NF = new Intl.NumberFormat("id-ID");
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
const chips = (a) =>
  a.length
    ? a.map((w) => `<span class="chip">${esc(w)}</span>`).join("")
    : "<i>(kosong)</i>";

/* Tampilkan hasil stemming: kata yang berubah ditandai "asal → dasar" */
function stemChips(before, after) {
  if (!after.length) return "<i>(kosong)</i>";
  return after
    .map((w, i) =>
      w !== before[i]
        ? `<span class="chip chg">${esc(before[i])} → ${esc(w)}</span>`
        : `<span class="chip">${esc(w)}</span>`,
    )
    .join("");
}

function safeUrl(u) {
  if (!u || u === "#") return null;
  try {
    const x = new URL(u, location.href);
    return /^https?:$/.test(x.protocol) ? x : null;
  } catch (e) {
    return null;
  }
}

/* Kata dianggap "cocok kueri" bila bentuk dasarnya (stem) sama dengan term kueri.
   Jadi kueri "mengajar" juga menandai "pengajaran", "diajarkan", dst. */
let hitCache = new Map();
function isHit(lower, terms) {
  if (hitCache.has(lower)) return hitCache.get(lower);
  let hit = terms.has(lower);
  if (!hit && S.idx && S.idx.o.stem) hit = terms.has(stemCached(lower));
  if (!hit) for (const t of terms) if (t.length >= 4 && lower.startsWith(t)) { hit = true; break; }
  hitCache.set(lower, hit);
  return hit;
}
function hl(text, terms) {
  if (!text) return "";
  if (!terms.size) return esc(text);
  let out = "", last = 0, m;
  const re = /[A-Za-z]+/g;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    out += isHit(m[0].toLowerCase(), terms) ? `<mark>${esc(m[0])}</mark>` : esc(m[0]);
    last = re.lastIndex;
  }
  return out + esc(text.slice(last));
}

/* Potongan abstrak dimulai di sekitar kata cocok pertama */
function snippetText(d, terms) {
  const b = (d.body || "").replace(/\s+/g, " ").trim();
  if (!b || b === "-") return null;
  let at = 0;
  if (terms.size) {
    const re = /[A-Za-z]+/g;
    let m;
    while ((m = re.exec(b))) {
      if (isHit(m[0].toLowerCase(), terms)) { at = Math.max(0, m.index - 80); break; }
    }
    if (at > 0) { const sp = b.indexOf(" ", at); if (sp > -1 && sp - at < 20) at = sp + 1; }
  }
  const len = 260;
  let end = at + len;
  if (end < b.length) {
    const sp = b.lastIndexOf(" ", end); // potong di batas kata
    if (sp > at + 120) end = sp;
  }
  return (at ? "… " : "") + b.slice(at, end) + (b.length > end ? " …" : "");
}

/* ---------- State tampilan ---------- */
let cur = null, // hasil pencarian terakhir (semua dokumen yang cocok)
  page = 1,
  cat = "ALL"; // kunci kategori aktif ("ALL" = semua)

function view() {
  if (cur.viewKey !== cat) {
    cur.view = cat === "ALL" ? cur.res : cur.res.filter((r) => r.d.kat === cat);
    cur.viewKey = cat;
  }
  return cur.view;
}

/* Hitung jumlah dokumen cocok per kategori (dari SELURUH hasil, bukan hanya satu halaman) */
function buildFacets(res) {
  const f = new Map();
  res.forEach(({ d }) => {
    const x = f.get(d.kat);
    if (x) x.n++;
    else f.set(d.kat, { label: d.topik, n: 1 });
  });
  return f;
}

/* Mode: beranda (hero) <-> hasil (form pindah ke topbar) */
function setMode(searched) {
  document.body.classList.toggle("searched", searched);
  const form = $("searchForm"),
    slot = searched ? $("topSlot") : $("heroSlot"),
    had = document.activeElement === $("q");
  if (form.parentNode !== slot) {
    slot.appendChild(form);
    if (had && matchMedia("(pointer:fine)").matches) $("q").focus();
  }
  $("results").hidden = !searched;
}

function goHome() {
  cur = null; cat = "ALL"; page = 1;
  $("q").value = "";
  if ($("facets")) { $("facets").innerHTML = ""; }
  setMode(false);
  if (!$("q").disabled) $("q").focus();
  window.scrollTo({ top: 0 });
}

/* ---------- Jalankan pencarian ---------- */
function run(keepCat = false) {
  const text = $("q").value.trim();
  if (!text || !S.idx) return;
  const t0 = performance.now();
  cur = search(text);
  cur.ms = performance.now() - t0;
  cur.text = text;
  cur.facets = buildFacets(cur.res);
  if (!keepCat || !cur.facets.has(cat)) cat = "ALL";
  page = 1;
  hitCache = new Map();

  log("Kueri", `"${text}" → ${cur.res.length} dokumen cocok dalam ${cur.facets.size} kategori (${cur.ms.toFixed(1)} ms)`);

  const p = cur.p;
  $("pre").innerHTML = `<div class="pipe">
    <div><small>1. Case folding</small>${esc(p.a)}</div>
    <div><small>2. Pembersihan tanda baca</small>${esc(p.b)}</div>
    <div><small>3. Tokenisasi</small>${chips(p.c)}</div>
    <div><small>4. Filtering stopword</small>${chips(p.d)}</div>
    <div><small>5. Stemming</small>${stemChips(p.d, p.e)}</div></div>`;

  setMode(true);
  drawFacets();
  drawResults();
}

/* ---------- Filter kategori (muncul SETELAH hasil ada) ---------- */
function drawFacets() {
  const box = $("facets");
  if (!cur.res.length) {
    box.hidden = true;
    box.innerHTML = "";
    $("results").classList.add("no-facets");
    return;
  }
  $("results").classList.remove("no-facets");
  const list = [...cur.facets.entries()].sort(
    (a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label, "id"),
  );
  const item = (key, label, n) =>
    `<li><button type="button" class="facet" data-cat="${esc(key)}" aria-pressed="${cat === key}"><span>${esc(label)}</span><b>${NF.format(n)}</b></button></li>`;
  box.innerHTML =
    `<div class="facet-title" id="facetTitle">Kategori</div><ul class="facet-list" aria-labelledby="facetTitle">` +
    item("ALL", "Semua kategori", cur.res.length) +
    list.map(([k, v]) => item(k, v.label, v.n)).join("") +
    `</ul>`;
  box.hidden = false;
}

/* ---------- Daftar hasil ---------- */
function drawResults() {
  const R = view(),
    n = +$("topk").value || 10,
    tp = Math.max(1, Math.ceil(R.length / n));
  page = Math.min(Math.max(1, page), tp);
  const terms = new Set(cur.qw.keys());
  const total = cur.res.length;
  const sec = (cur.ms / 1000).toFixed(2).replace(".", ",");
  const label = cat === "ALL" ? "" : cur.facets.get(cat).label;

  /* Ringkasan */
  if (!total) {
    $("summary").innerHTML = `<span>0 hasil <span class="t">(${sec} dtk)</span></span>`;
  } else if (cat === "ALL") {
    $("summary").innerHTML = `<span><b>${NF.format(total)}</b> hasil <span class="t">(${sec} dtk)</span></span><span class="summary-meta"><span>Urutan: relevansi</span>${tp > 1 ? `<span>Halaman ${page} dari ${tp}</span>` : ""}</span>`;
  } else {
    $("summary").innerHTML = `<span><b>${NF.format(R.length)}</b> hasil dalam <b>${esc(label)}</b> <span class="t">dari ${NF.format(total)} hasil</span><button type="button" class="ghost clr" data-cat="ALL">Hapus filter ✕</button></span><span class="summary-meta"><span>Urutan: relevansi</span>${tp > 1 ? `<span>Halaman ${page} dari ${tp}</span>` : ""}</span>`;
  }

  /* Peringatan term tak dikenal */
  $("notice").innerHTML =
    (KATA_DASAR.size
      ? ""
      : `<div class="notice">Kamus kata dasar (kata-dasar.txt) belum termuat, sehingga stemming tidak berjalan. Buka Detail Komputasi → Log Sistem untuk rinciannya.</div>`) +
    (cur.unknown.length
      ? `<div class="notice">Kata tidak ditemukan di indeks: <b>${esc(cur.unknown.join(", "))}</b></div>`
      : "");

  /* Daftar */
  if (!total) {
    $("list").innerHTML = `<div class="empty"><h2>Tidak ada dokumen yang cocok</h2><div>Pencarian “${esc(cur.text)}” tidak menemukan hasil.<br><ul><li>Periksa ejaan kata kunci</li><li>Gunakan kata yang lebih umum</li><li>Kurangi jumlah kata kunci</li></ul></div></div>`;
    $("pg").innerHTML = "";
    return;
  }

  const max = cur.res[0].s || 1;
  let h = "";
  R.slice((page - 1) * n, page * n).forEach((r, i) => {
    const rank = (page - 1) * n + i + 1,
      d = r.d,
      u = safeUrl(d.url),
      snip = snippetText(d, terms);
    const rows = [...terms]
      .map(
        (w) =>
          `<tr><td>${esc(w)}</td><td>${cur.qt.get(w)}</td><td>${d.tf.get(w) || 0}</td><td>${S.idx.df.get(w)}</td><td>${S.idx.idf.get(w).toFixed(4)}</td><td>${cur.qw.get(w).toFixed(4)}</td><td>${(d.w.get(w) || 0).toFixed(4)}</td></tr>`,
      )
      .join("");
    const qlen = Math.sqrt([...cur.qw.values()].reduce((a, x) => a + x * x, 0));
    const title = hl(d.title, terms);

    h += `<div class="res${rank === 1 ? " top" : ""}">
      <div class="rank" aria-hidden="true">${rank}</div>
      <div class="res-main">
        <h3>${u ? `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title}</h3>
        <div class="tags">
          <span class="tag">${esc(d.topik)}</span>
          <span>${esc(d.penulis)}</span>
          ${u ? `<span class="dom">${esc(u.hostname.replace(/^www\./, ""))}</span>` : ""}
        </div>
        ${snip ? `<p class="snip">${hl(snip, terms)}</p>` : `<p class="snip na">Abstrak tidak tersedia</p>`}
        <div class="scorebar">
          <span>Skor <span class="score">${r.s.toFixed(4)}</span></span>
          <div class="bar" aria-hidden="true"><i style="width:${((r.s / max) * 100).toFixed(0)}%"></i></div>
          <span class="idl">ID ${d.id}</span>
        </div>
        <details><summary>Rincian pembobotan</summary>
          <div class="sc"><table><tr><th>Term</th><th>tf kueri</th><th>tf dok</th><th>df</th><th>idf</th><th>w kueri</th><th>w dok</th></tr>${rows}</table></div>
          <div class="meta">|q| = ${qlen.toFixed(4)} · |d| = ${d.norm.toFixed(4)}</div>
        </details>
      </div>
    </div>`;
  });
  $("list").innerHTML = h;
  drawPager(tp);
}

/* ---------- Paginasi ringkas ---------- */
function drawPager(tp) {
  if (tp <= 1) { $("pg").innerHTML = ""; return; }
  const b = (p, txt, o = {}) =>
    `<button type="button" class="${o.cur ? "cur" : "ghost"}${o.nav ? " nav" : ""}" data-p="${p}"${o.dis ? " disabled" : ""}${o.title ? ` title="${o.title}" aria-label="${o.title}"` : ""}${o.cur ? ' aria-current="page"' : ""}>${txt}</button>`;
  let h = b(1, "«", { nav: 1, dis: page === 1, title: "Halaman pertama" }) +
    b(page - 1, "‹", { nav: 1, dis: page === 1, title: "Halaman sebelumnya" });

  let s = Math.max(1, page - 2), e = Math.min(tp, page + 2);
  if (page <= 3) e = Math.min(tp, 5);
  if (page >= tp - 2) s = Math.max(1, tp - 4);
  if (s > 1) { h += b(1, "1"); if (s > 2) h += `<span class="dots">…</span>`; }
  for (let i = s; i <= e; i++) h += b(i, i, { cur: i === page });
  if (e < tp) { if (e < tp - 1) h += `<span class="dots">…</span>`; h += b(tp, tp); }

  h += b(page + 1, "›", { nav: 1, dis: page === tp, title: "Halaman berikutnya" }) +
    b(tp, "»", { nav: 1, dis: page === tp, title: "Halaman terakhir" });
  $("pg").innerHTML = h;
}

function scrollToResults() {
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Sidebar detail komputasi ---------- */
function openSidebar() {
  $("sidebar").classList.add("active");
  $("sidebarOverlay").classList.add("active");
  $("sidebar").setAttribute("aria-hidden", "false");
  $("toggleSidebar").setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  $("sidebar").classList.remove("active");
  $("sidebarOverlay").classList.remove("active");
  $("sidebar").setAttribute("aria-hidden", "true");
  $("toggleSidebar").setAttribute("aria-expanded", "false");
}
$("toggleSidebar").onclick = openSidebar;
$("closeSidebar").onclick = closeSidebar;
$("sidebarOverlay").onclick = closeSidebar;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
  if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !$("q").disabled) {
    e.preventDefault();
    $("q").focus();
    $("q").select();
  }
});

/* ---------- Tema terang/gelap ---------- */
$("themeBtn").onclick = () => {
  const r = document.documentElement;
  const next = r.getAttribute("data-theme") === "dark" ? "light" : "dark";
  r.setAttribute("data-theme", next);
  try { localStorage.setItem("js-theme", next); } catch (e) {}
};

/* ---------- Event pencarian ---------- */
$("searchForm").onsubmit = (e) => {
  e.preventDefault();
  run();
  if (!matchMedia("(pointer:fine)").matches) $("q").blur(); // tutup keyboard di HP
};
$("brand").onclick = (e) => {
  e.preventDefault();
  goHome();
};

/* Klik kategori / hapus filter */
$("results").addEventListener("click", (e) => {
  const c = e.target.closest("button[data-cat]");
  if (c && cur) {
    cat = c.dataset.cat;
    page = 1;
    log("Filter", `Kategori: ${cat === "ALL" ? "Semua" : cur.facets.get(cat).label}`);
    drawFacets();
    drawResults();
    scrollToResults();
    return;
  }
  const p = e.target.closest("button[data-p]");
  if (p && !p.disabled && cur) {
    page = +p.dataset.p;
    drawResults();
    scrollToResults();
  }
});

$("topk").onchange = () => {
  if (cur) { page = 1; drawResults(); }
};

/* ---------- Log ---------- */
$("logclear").onclick = () => {
  LOG.length = 0;
  $("logbody").textContent = "";
};
$("logcopy").onclick = () => {
  const b = $("logcopy");
  try {
    navigator.clipboard.writeText(LOG.join("\n")).then(
      () => { b.textContent = "Tersalin"; },
      () => { b.textContent = "Gagal"; },
    );
  } catch (e) {
    b.textContent = "Gagal";
  }
  setTimeout(() => { b.textContent = "Salin"; }, 1500);
};
