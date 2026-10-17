"use strict";
const $ = (id) => document.getElementById(id);
const STOP = new Set(
  "yang dan di ke dari untuk pada dengan ini itu adalah juga dalam atau akan oleh sebagai karena tidak ada dapat telah sudah lebih serta saat bagi para agar jika hanya masih sebuah suatu mereka kami kita saya anda dia ia nya lah kah pun bahwa tetapi namun sehingga antara setelah sebelum hingga seperti secara yaitu yakni tersebut dua tiga atau the of and to in is a for on with".split(
    " ",
  ),
);
// Stopword tambahan (kata fungsi umum) agar tidak ikut di-stem/diindeks
"terhadap melalui kepada tentang bisa harus setiap lain lainnya banyak sangat semua beberapa ialah merupakan berbagai sedangkan ketika dimana mana apa bagaimana dalam telah bukan belum sudah dengan tanpa sampai lalu kemudian maka jadi sebab oleh pula bila ini itu hal dll dsb dst yg dgn utk dr pd this that are was were be by as at from it its an has have not can which their these also than into we our been may such other more each both between during using used use"
  .split(" ")
  .forEach((w) => STOP.add(w));
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
      log(
        "Warning",
        `kata-dasar.txt tidak ditemukan (HTTP ${res.status}). Stemming TIDAK aktif.`,
      );
      return;
    }
    const buf = await res.arrayBuffer(),
      u = new Uint8Array(buf);
    let enc = "utf-8";
    if (u[0] === 0xff && u[1] === 0xfe) enc = "utf-16le";
    else if (u[0] === 0xfe && u[1] === 0xff) enc = "utf-16be";
    const text = new TextDecoder(enc).decode(buf).replace(/^\uFEFF/, "");
    if (/^\s*</.test(text)) {
      log(
        "Warning",
        "kata-dasar.txt berisi HTML, bukan daftar kata. Stemming TIDAK aktif.",
      );
      return;
    }
    text.split(/[\s,;"'\[\]]+/).forEach((k) => {
      k = k.trim().toLowerCase();
      if (k) KATA_DASAR.add(k);
    });
    if (KATA_DASAR.size < 1000)
      log(
        "Warning",
        `Kamus hanya berisi ${KATA_DASAR.size} kata (Sastrawi ±30.000). Periksa isi kata-dasar.txt.`,
      );
    else
      log(
        "Sistem",
        `Berhasil memuat ${KATA_DASAR.size} kata dasar (encoding ${enc}).`,
      );
    const uji = ["pendekatan", "mengajar", "kesehatan"]
      .map((w) => `${w}→${stem(w)}`)
      .join(", ");
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
    if (!loadText(text))
      throw new Error("Isi data.csv kosong atau tidak terbaca");
  } catch (error) {
    log(
      "Error",
      `${error.message}. Pastikan data.csv ada di folder yang sama dan aplikasi dijalankan lewat localhost/server.`,
    );
    if ($("stat"))
      $("stat").innerHTML = '<span class="err">Gagal memuat dataset.</span>';
    setHeroStat(
      '<span class="err">Dataset gagal dimuat. Pastikan <b>data.csv</b> ada di folder yang sama dan jalankan lewat localhost/server.</span>',
    );
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
  if (r === undefined) {
    r = stem(w);
    STEM_CACHE.set(w, r);
  }
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
    if ($("stat"))
      $("stat").innerHTML =
        '<span class="err">CSV kosong atau tidak terbaca.</span>';
    return false;
  }
  S.head = rows[0].map((h) => h.trim());
  S.rows = rows.slice(1);
  log(
    "CSV",
    `${S.rows.length} baris data dibaca, ${S.head.length} kolom: ${S.head.join(", ")}`,
  );

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
    const topik =
      topi >= 0 && r[topi] && r[topi].trim() ? r[topi].trim() : "Umum";
    return {
      id: i + 1,
      title: (r[ti] || "Dokumen " + (i + 1)).trim(),
      body: (r[bi] || "").trim(),
      topik,
      kat: topik.toLowerCase(), // kunci pengelompokan kategori
      penulis:
        peni >= 0 && r[peni] && r[peni].trim() ? r[peni].trim() : "Anonim",
      url: urli >= 0 && r[urli] ? r[urli].trim() : "",
    };
  });

  const N = docs.length,
    df = new Map(),
    cf = new Map(), // TF koleksi: total kemunculan term di seluruh dokumen
    inv = new Map();
  log("Indeks", `Mulai mengindeks ${N} dokumen...`);

  docs.forEach((d) => {
    d.tokens = steps(d.title + " " + d.body, o).e;
    const tf = new Map();
    d.tokens.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    d.tf = tf;
    tf.forEach((f, w) => {
      df.set(w, (df.get(w) || 0) + 1);
      cf.set(w, (cf.get(w) || 0) + f);
    });
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
  S.idx = { N, df, cf, idf, inv, o };
  S.terms = null; // daftar term untuk tabel koleksi dibangun ulang saat dibuka

  const ms = Math.round(performance.now() - t0);
  const nCat = new Set(docs.map((d) => d.kat)).size;
  log("Indeks", `Inverted index selesai: ${inv.size} term unik (${ms} ms)`);

  if ($("stat"))
    $("stat").innerHTML =
      `<span>Dokumen <b>${NF.format(N)}</b></span><span>Term unik <b>${NF.format(df.size)}</b></span><span>Kategori <b>${nCat}</b></span><span>Waktu indeks <b>${ms} ms</b></span>${KATA_DASAR.size ? `<span>Kamus <b>${NF.format(KATA_DASAR.size)}</b> kata</span>` : `<span class="err">Kamus belum termuat, stemming tidak aktif</span>`}`;
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
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
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
  if (!hit)
    for (const t of terms)
      if (t.length >= 4 && lower.startsWith(t)) {
        hit = true;
        break;
      }
  hitCache.set(lower, hit);
  return hit;
}
function hl(text, terms) {
  if (!text) return "";
  if (!terms.size) return esc(text);
  let out = "",
    last = 0,
    m;
  const re = /[A-Za-z]+/g;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    out += isHit(m[0].toLowerCase(), terms)
      ? `<mark>${esc(m[0])}</mark>`
      : esc(m[0]);
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
      if (isHit(m[0].toLowerCase(), terms)) {
        at = Math.max(0, m.index - 80);
        break;
      }
    }
    if (at > 0) {
      const sp = b.indexOf(" ", at);
      if (sp > -1 && sp - at < 20) at = sp + 1;
    }
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
  cur = null;
  cat = "ALL";
  page = 1;
  $("q").value = "";
  if ($("facets")) {
    $("facets").innerHTML = "";
  }
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
  cs.docId = null;
  cs.tp = 1;
  cs.ax = null;
  cs.zoom = null;

  log(
    "Kueri",
    `"${text}" → ${cur.res.length} dokumen cocok dalam ${cur.facets.size} kategori (${cur.ms.toFixed(1)} ms)`,
  );

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
    $("summary").innerHTML =
      `<span>0 hasil <span class="t">(${sec} dtk)</span></span>`;
  } else if (cat === "ALL") {
    $("summary").innerHTML =
      `<span><b>${NF.format(total)}</b> hasil <span class="t">(${sec} dtk)</span></span><span class="summary-meta"><button type="button" class="ghost sm" data-calc="koleksi">Perhitungan VSM</button><span>Urutan: relevansi</span>${tp > 1 ? `<span>Halaman ${page} dari ${tp}</span>` : ""}</span>`;
  } else {
    $("summary").innerHTML =
      `<span><b>${NF.format(R.length)}</b> hasil dalam <b>${esc(label)}</b> <span class="t">dari ${NF.format(total)} hasil</span><button type="button" class="ghost clr" data-cat="ALL">Hapus filter ✕</button></span><span class="summary-meta"><button type="button" class="ghost sm" data-calc="koleksi">Perhitungan VSM</button><span>Urutan: relevansi</span>${tp > 1 ? `<span>Halaman ${page} dari ${tp}</span>` : ""}</span>`;
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
    $("list").innerHTML =
      `<div class="empty"><h2>Tidak ada dokumen yang cocok</h2><div>Pencarian “${esc(cur.text)}” tidak menemukan hasil.<br><ul><li>Periksa ejaan kata kunci</li><li>Gunakan kata yang lebih umum</li><li>Kurangi jumlah kata kunci</li></ul></div></div>`;
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
          <button type="button" class="ghost sm calc-link" data-calc="cosine" data-doc="${d.id}">Perhitungan cosine lengkap →</button>
        </details>
      </div>
    </div>`;
  });
  $("list").innerHTML = h;
  drawPager(tp);
}

/* ---------- Paginasi ringkas ---------- */
function drawPager(tp) {
  if (tp <= 1) {
    $("pg").innerHTML = "";
    return;
  }
  const b = (p, txt, o = {}) =>
    `<button type="button" class="${o.cur ? "cur" : "ghost"}${o.nav ? " nav" : ""}" data-p="${p}"${o.dis ? " disabled" : ""}${o.title ? ` title="${o.title}" aria-label="${o.title}"` : ""}${o.cur ? ' aria-current="page"' : ""}>${txt}</button>`;
  let h =
    b(1, "«", { nav: 1, dis: page === 1, title: "Halaman pertama" }) +
    b(page - 1, "‹", { nav: 1, dis: page === 1, title: "Halaman sebelumnya" });

  let s = Math.max(1, page - 2),
    e = Math.min(tp, page + 2);
  if (page <= 3) e = Math.min(tp, 5);
  if (page >= tp - 2) s = Math.max(1, tp - 4);
  if (s > 1) {
    h += b(1, "1");
    if (s > 2) h += `<span class="dots">…</span>`;
  }
  for (let i = s; i <= e; i++) h += b(i, i, { cur: i === page });
  if (e < tp) {
    if (e < tp - 1) h += `<span class="dots">…</span>`;
    h += b(tp, tp);
  }

  h +=
    b(page + 1, "›", {
      nav: 1,
      dis: page === tp,
      title: "Halaman berikutnya",
    }) + b(tp, "»", { nav: 1, dis: page === tp, title: "Halaman terakhir" });
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
  if (
    e.key === "/" &&
    !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) &&
    !$("q").disabled
  ) {
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
  try {
    localStorage.setItem("js-theme", next);
  } catch (e) {}
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
    log(
      "Filter",
      `Kategori: ${cat === "ALL" ? "Semua" : cur.facets.get(cat).label}`,
    );
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
  if (cur) {
    page = 1;
    drawResults();
  }
};

/* =====================================================================
   PERHITUNGAN VSM & TF-IDF
   Tab 1: TF & DF seluruh koleksi · Tab 2: matriks TF dan bobot TF-IDF
   Tab 3: representasi vektor VSM · Tab 4: langkah hitung cosine similarity
   ===================================================================== */
const f4 = (x) => Number(x).toFixed(4),
  f6 = (x) => Number(x).toFixed(6);
const cs = {
  tab: "koleksi",
  docId: null,
  tq: "",
  ts: "df",
  tp: 1,
  tonly: false,
  ax: null,
  zoom: null,
};
const TERM_PAGE = 20;
const shortTxt = (t, n = 70) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

function termList() {
  if (!S.terms) {
    const I = S.idx;
    S.terms = [...I.df.entries()].map(([t, df]) => ({
      t,
      df,
      idf: I.idf.get(t),
      cf: I.cf.get(t),
    }));
  }
  return S.terms;
}

/* 10 dokumen teratas (mengikuti filter kategori aktif) + dokumen yang dipilih bila di luar 10 besar */
function calcDocs() {
  const R = view(),
    top = R.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  if (cs.docId && !top.some((x) => x.d.id === cs.docId)) {
    const i = R.findIndex((r) => r.d.id === cs.docId);
    if (i >= 0) top.push({ ...R[i], rank: i + 1 });
  }
  return top;
}
const noQ = () =>
  `<div class="empty"><h2>Tidak ada term kueri di indeks</h2><div>Semua kata pada kueri tidak ditemukan di koleksi, sehingga vektor kueri bernilai nol.</div></div>`;

function docSelect(D) {
  const sel = D.find((x) => x.d.id === cs.docId) || D[0];
  cs.docId = sel.d.id;
  const opts = D.map(
    (x) =>
      `<option value="${x.d.id}"${x.d.id === sel.d.id ? " selected" : ""}>#${x.rank} · ${esc(shortTxt(x.d.title, 80))} (ID ${x.d.id})</option>`,
  ).join("");
  return {
    sel,
    html: `<label class="docsel">Dokumen: <select id="docSel">${opts}</select></label>`,
  };
}
const docHead = (D) =>
  D.map(
    (x) =>
      `<th title="${esc(x.d.title)}">D${x.rank}<small>ID ${x.d.id}</small></th>`,
  ).join("");
const legend = (D) =>
  `<ul class="legend">${D.map((x) => `<li><b>D${x.rank}</b> ${esc(shortTxt(x.d.title, 90))} <span class="tag">${esc(x.d.topik)}</span></li>`).join("")}</ul>`;
const qNorm = () =>
  Math.sqrt([...cur.qw.values()].reduce((a, x) => a + x * x, 0));

/* ---------- Tab 1: TF & DF seluruh koleksi ---------- */
function tabKoleksi() {
  const I = S.idx,
    tot = S.docs.reduce((a, d) => a + d.tokens.length, 0);
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  return `
  <div class="tiles">
    ${tile(NF.format(I.N), "Dokumen (N)")}
    ${tile(NF.format(I.df.size), "Term unik (dimensi vektor)")}
    ${tile(NF.format(tot), "Total token koleksi")}
    ${tile((tot / I.N).toFixed(1).replace(".", ","), "Rata-rata token / dokumen")}
  </div>
  <div class="formula">
    <b>DF(t)</b> = jumlah dokumen yang memuat term <i>t</i><br>
    <b>CF(t)</b> = TF koleksi = total kemunculan term <i>t</i> di seluruh dokumen<br>
    <b>IDF(t)</b> = log₁₀( N / DF(t) ) &nbsp;dengan N = ${NF.format(I.N)}
  </div>
  <h4 class="calc-sec">Tabel TF &amp; DF seluruh koleksi</h4>
  <div class="ctl">
    <input type="text" id="tq" placeholder="Cari term…" value="${esc(cs.tq)}" aria-label="Cari term" />
    <select id="ts" aria-label="Urutkan">
      <option value="df"${cs.ts === "df" ? " selected" : ""}>Urut: DF terbanyak</option>
      <option value="cf"${cs.ts === "cf" ? " selected" : ""}>Urut: CF (TF koleksi) terbanyak</option>
      <option value="idf"${cs.ts === "idf" ? " selected" : ""}>Urut: IDF tertinggi</option>
      <option value="t"${cs.ts === "t" ? " selected" : ""}>Urut: abjad</option>
    </select>
    <div class="seg" role="group" aria-label="Tampilkan term">
      <button type="button" class="ghost" data-tonly="0" aria-pressed="${!cs.tonly}">Semua term</button>
      <button type="button" class="ghost" data-tonly="1" aria-pressed="${cs.tonly}">Term kueri</button>
    </div>
  </div>
  <div class="sc tall"><table><thead><tr><th class="l">No</th><th class="l">Term</th><th>DF</th><th>IDF</th><th>CF (TF koleksi)</th></tr></thead><tbody id="termTable"></tbody></table></div>
  <div class="pg" id="termPager"></div>
  <p class="muted" id="termInfo"></p>`;
}

function drawTermTable() {
  const q = cs.tq.trim().toLowerCase();
  let L = termList();
  if (cs.tonly) L = L.filter((x) => cur.qw.has(x.t));
  if (q) L = L.filter((x) => x.t.includes(q));
  L = [...L].sort(
    cs.ts === "t"
      ? (a, b) => a.t.localeCompare(b.t)
      : (a, b) => b[cs.ts] - a[cs.ts] || a.t.localeCompare(b.t),
  );
  const tp = Math.max(1, Math.ceil(L.length / TERM_PAGE));
  cs.tp = Math.min(Math.max(1, cs.tp), tp);
  const from = (cs.tp - 1) * TERM_PAGE;
  $("termTable").innerHTML = L.length
    ? L.slice(from, from + TERM_PAGE)
        .map(
          (x, i) =>
            `<tr class="${cur.qw.has(x.t) ? "qrow" : ""}"><td class="l">${from + i + 1}</td><td class="l">${esc(x.t)}</td><td>${NF.format(x.df)}</td><td>${f4(x.idf)}</td><td>${NF.format(x.cf)}</td></tr>`,
        )
        .join("")
    : `<tr><td class="l" colspan="5">Tidak ada term yang cocok.</td></tr>`;
  $("termInfo").textContent =
    `${NF.format(L.length)} dari ${NF.format(S.idx.df.size)} term · baris berlatar hijau = term kueri`;
  $("termPager").innerHTML =
    tp > 1
      ? `<button type="button" class="ghost nav" data-tp="${cs.tp - 1}"${cs.tp === 1 ? " disabled" : ""} aria-label="Sebelumnya">‹</button><span class="dots">Halaman ${NF.format(cs.tp)} dari ${NF.format(tp)}</span><button type="button" class="ghost nav" data-tp="${cs.tp + 1}"${cs.tp === tp ? " disabled" : ""} aria-label="Berikutnya">›</button>`
      : "";
}

/* ---------- Tab 2: matriks TF dan bobot TF-IDF (term kueri × dokumen teratas) ---------- */
function tabMatriks() {
  if (!cur.qw.size) return noQ();
  const D = calcDocs(),
    T = [...cur.qw.keys()],
    I = S.idx;
  const rowsTF = T.map(
    (t) =>
      `<tr><td class="l">${esc(t)}</td><td>${I.df.get(t)}</td><td>${f4(I.idf.get(t))}</td><td>${cur.qt.get(t)}</td>${D.map((x) => `<td>${x.d.tf.get(t) || 0}</td>`).join("")}</tr>`,
  ).join("");
  const rowsW = T.map(
    (t) =>
      `<tr><td class="l">${esc(t)}</td><td>${I.df.get(t)}</td><td>${f4(I.idf.get(t))}</td><td>${f4(cur.qw.get(t))}</td>${D.map((x) => `<td>${f4(x.d.w.get(t) || 0)}</td>`).join("")}</tr>`,
  ).join("");
  return `
  <p class="muted">Baris = term kueri, kolom = kueri (q) dan ${D.length} dokumen teratas. Dokumen yang ditampilkan mengikuti filter kategori aktif.</p>
  ${legend(D)}
  <h4 class="calc-sec">Matriks TF (frekuensi mentah)</h4>
  <div class="sc"><table><thead><tr><th class="l">Term</th><th>DF</th><th>IDF</th><th>q</th>${docHead(D)}</tr></thead><tbody>${rowsTF}</tbody></table></div>
  <h4 class="calc-sec">Matriks bobot TF-IDF</h4>
  <div class="formula"><b>w(t,d)</b> = (1 + log₁₀ TF(t,d)) × IDF(t) &nbsp;·&nbsp; bernilai 0 jika TF = 0</div>
  <div class="sc"><table><thead><tr><th class="l">Term</th><th>DF</th><th>IDF</th><th>q</th>${docHead(D)}</tr></thead><tbody>${rowsW}</tbody>
    <tfoot><tr><td class="l">Norma |v| (seluruh dimensi)</td><td></td><td></td><td>${f4(qNorm())}</td>${D.map((x) => `<td>${f4(x.d.norm)}</td>`).join("")}</tr></tfoot></table></div>`;
}

/* ---------- Tab 3: representasi vektor VSM ---------- */
function tabVektor() {
  if (!cur.qw.size) return noQ();
  const D = calcDocs(),
    T = [...cur.qw.keys()],
    I = S.idx,
    V = I.df.size;
  const nz = (d) => [...d.w.values()].filter((x) => x > 0).length;
  const comp = (m) => `⟨ ${T.map((t) => f4(m.get(t) || 0)).join(", ")} ⟩`;
  const { sel, html } = docSelect(D);
  const d = sel.d,
    ent = [...d.w.entries()].sort((a, b) => b[1] - a[1]);
  const rows = ent
    .map(
      ([t, w], i) =>
        `<tr class="${cur.qw.has(t) ? "qrow" : ""}"><td class="l">${i + 1}</td><td class="l">${esc(t)}</td><td>${d.tf.get(t)}</td><td>${I.df.get(t)}</td><td>${f4(I.idf.get(t))}</td><td>${f4(w)}</td></tr>`,
    )
    .join("");
  return `
  <p>Setiap dokumen dan kueri direpresentasikan sebagai <b>vektor bobot TF-IDF</b> dalam ruang berdimensi <b>V = ${NF.format(V)}</b> (satu dimensi untuk tiap term unik koleksi). Dimensi yang tidak muncul bernilai 0.</p>
  <h4 class="calc-sec">Vektor kueri</h4>
  <div class="vec">q = ⟨ ${T.map((t) => `<span class="vt">${esc(t)}: <b>${f4(cur.qw.get(t))}</b></span>`).join(", ")} ⟩ &nbsp;+ 0 pada ${NF.format(V - T.length)} dimensi lainnya</div>
  <h4 class="calc-sec">Vektor dokumen pada sumbu term kueri</h4>
  <p class="muted">Urutan komponen: ${T.map((t) => `<b>${esc(t)}</b>`).join(", ")}. Dimensi di luar term kueri tetap ikut dalam norma |d|.</p>
  <div class="sc"><table><thead><tr><th class="l">Vektor</th><th class="l">Komponen pada term kueri</th><th>Dimensi tak-nol</th><th>Norma |v|</th></tr></thead><tbody>
    <tr><td class="l"><b>q</b></td><td class="l">${comp(cur.qw)}</td><td>${T.length}</td><td>${f4(qNorm())}</td></tr>
    ${D.map((x) => `<tr data-doc="${x.d.id}" class="${x.d.id === sel.d.id ? "sel" : ""}"><td class="l"><b>D${x.rank}</b> <small>ID ${x.d.id}</small></td><td class="l">${comp(x.d.w)}</td><td>${nz(x.d)}</td><td>${f4(x.d.norm)}</td></tr>`).join("")}
  </tbody></table></div>
  <h4 class="calc-sec">Vektor lengkap satu dokumen</h4>
  <div class="ctl">${html}</div>
  <p class="muted">D${sel.rank} memiliki <b>${nz(d)}</b> dimensi tak-nol dari ${NF.format(V)}. Norma |d| = √(Σ w²) = <b>${f4(d.norm)}</b>. Baris hijau = term kueri.</p>
  <div class="sc tall"><table><thead><tr><th class="l">No</th><th class="l">Term (dimensi)</th><th>TF</th><th>DF</th><th>IDF</th><th>w = (1+log₁₀TF)×IDF</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Tab Visualisasi: gambar vektor ---------- */
const RAD = Math.PI / 180;
const angleOf = (x) => Math.acos(Math.min(1, Math.max(0, x.s))) / RAD; // sudut sebenarnya (ruang penuh)
const vzDefs = (k) =>
  ["q", "d", "s"]
    .map(
      (c) =>
        `<marker id="vz-${k}-${c}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4.5 L0,9 z" class="vz-head-${c}"/></marker>`,
    )
    .join("");

/* Gambar 1: bidang 2 sumbu term (proyeksi vektor ke dua dimensi) */
function svgPlane(D, sel, X, Y) {
  const W = 560,
    H = 420,
    m = { l: 58, r: 26, t: 20, b: 54 };
  const pw = W - m.l - m.r,
    ph = H - m.t - m.b;
  const g = (w, t) => w.get(t) || 0;
  const all = [g(cur.qw, X), g(cur.qw, Y)];
  D.forEach((x) => all.push(g(x.d.w, X), g(x.d.w, Y)));
  const max = Math.max(...all, 1e-9) * 1.12;
  const sx = (v) => m.l + (v / max) * pw,
    sy = (v) => m.t + ph - (v / max) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="vz" role="img" aria-label="Vektor kueri dan dokumen pada bidang dua term"><defs>${vzDefs("p")}</defs>`;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    s += `<line class="vz-grid" x1="${sx(v)}" y1="${m.t}" x2="${sx(v)}" y2="${m.t + ph}"/><line class="vz-grid" x1="${m.l}" y1="${sy(v)}" x2="${m.l + pw}" y2="${sy(v)}"/>`;
    s += `<text class="vz-tick" x="${sx(v)}" y="${m.t + ph + 16}" text-anchor="middle">${v.toFixed(2)}</text><text class="vz-tick" x="${m.l - 8}" y="${sy(v) + 4}" text-anchor="end">${v.toFixed(2)}</text>`;
  }
  s += `<line class="vz-axis" x1="${m.l}" y1="${m.t + ph}" x2="${m.l + pw}" y2="${m.t + ph}"/><line class="vz-axis" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ph}"/>`;
  s += `<text class="vz-text" x="${m.l + pw / 2}" y="${H - 10}" text-anchor="middle">sumbu X: bobot term “${esc(X)}”</text>`;
  s += `<text class="vz-text" transform="rotate(-90 16 ${m.t + ph / 2})" x="16" y="${m.t + ph / 2}" text-anchor="middle">sumbu Y: bobot term “${esc(Y)}”</text>`;

  const seen = new Map();
  const doc = (x, isSel) => {
    const wx = g(x.d.w, X),
      wy = g(x.d.w, Y),
      tx = sx(wx),
      ty = sy(wy);
    const key = wx.toFixed(4) + "|" + wy.toFixed(4),
      n = seen.get(key) || 0;
    seen.set(key, n + 1);
    let o = `<line class="${isSel ? "vz-s" : "vz-d"}" x1="${sx(0)}" y1="${sy(0)}" x2="${tx}" y2="${ty}" marker-end="url(#vz-p-${isSel ? "s" : "d"})"/>`;
    o += `<g data-vdoc="${x.d.id}" class="vzdoc"><circle cx="${tx}" cy="${ty}" r="13" fill="transparent"/><text class="${isSel ? "vz-lbl-s" : "vz-text"}" x="${tx + 8}" y="${ty - 8 - n * 13}">D${x.rank}</text></g>`;
    return o;
  };
  D.filter((x) => x.d.id !== sel.d.id).forEach((x) => (s += doc(x, false)));
  s += doc(sel, true);
  // garis bantu komponen dokumen terpilih
  const sxv = g(sel.d.w, X),
    syv = g(sel.d.w, Y);
  s += `<line class="vz-guide" x1="${sx(sxv)}" y1="${sy(syv)}" x2="${sx(sxv)}" y2="${sy(0)}"/><line class="vz-guide" x1="${sx(sxv)}" y1="${sy(syv)}" x2="${sx(0)}" y2="${sy(syv)}"/>`;
  s += `<text class="vz-lbl-s small" x="${sx(sxv)}" y="${sy(0) - 6}" text-anchor="middle">${f4(sxv)}</text><text class="vz-lbl-s small" x="${m.l + 6}" y="${sy(syv) - 5}">${f4(syv)}</text>`;
  // vektor kueri
  const qx = sx(g(cur.qw, X)),
    qy = sy(g(cur.qw, Y));
  s += `<line class="vz-q" x1="${sx(0)}" y1="${sy(0)}" x2="${qx}" y2="${qy}" marker-end="url(#vz-p-q)"/><text class="vz-lbl-q" x="${qx + 8}" y="${qy + 16}">q</text>`;
  return s + "</svg>";
}

/* Gambar 2: sudut sebenarnya antara q dan tiap dokumen (vektor satuan) */
function svgFan(D, sel, zoom) {
  const W = 440,
    H = 410,
    ox = 58,
    oy = 372,
    R = 270;
  const P = (deg, r) => [
    ox + r * Math.cos(deg * RAD),
    oy - r * Math.sin(deg * RAD),
  ];
  const angs = D.map(angleOf),
    amin = Math.min(...angs),
    amax = Math.max(...angs),
    span = amax - amin;
  const disp = (a) =>
    zoom ? (span < 1e-6 ? 45 : 14 + ((a - amin) / span) * 62) : a;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="vz fan" role="img" aria-label="Sudut antara vektor kueri dan vektor dokumen"><defs>${vzDefs("f")}</defs>`;
  s += `<path class="vz-arc" d="M${ox + R},${oy} A${R},${R} 0 0 0 ${ox},${oy - R}"/>`;
  s += `<line class="vz-axis" x1="${ox}" y1="${oy}" x2="${ox + R + 14}" y2="${oy}"/><line class="vz-axis" x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - R - 14}"/>`;
  if (!zoom) {
    for (let a = 15; a <= 75; a += 15) {
      const [x1, y1] = P(a, R - 6),
        [x2, y2] = P(a, R + 6),
        [tx, ty] = P(a, R - 20);
      s += `<line class="vz-axis" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="vz-tick" x="${tx}" y="${ty + 4}" text-anchor="middle">${a}°</text>`;
    }
    s += `<text class="vz-tick" x="${ox + 4}" y="${oy - R + 2}">90°</text>`;
  }
  // penempatan label bertingkat agar tidak saling menimpa
  const items = D.map((x, i) => ({ x, a: angs[i], p: disp(angs[i]) })).sort(
    (u, v) => u.p - v.p,
  );
  const last = [],
    sep = 5;
  items.forEach((it) => {
    let lv = 0;
    while (lv < 6 && last[lv] !== undefined && it.p - last[lv] < sep) lv++;
    it.lv = Math.min(lv, 6);
    last[it.lv] = it.p;
  });
  const drawDoc = (it, isSel) => {
    const [tx, ty] = P(it.p, R),
      rl = R + 16 + it.lv * 17,
      [lx, ly] = P(it.p, rl);
    let o = `<line class="${isSel ? "vz-s" : "vz-d"}" x1="${ox}" y1="${oy}" x2="${tx}" y2="${ty}" marker-end="url(#vz-f-${isSel ? "s" : "d"})"/>`;
    if (it.lv > 0) {
      const [ax, ay] = P(it.p, rl - 9);
      o += `<line class="vz-lead" x1="${tx}" y1="${ty}" x2="${ax}" y2="${ay}"/>`;
    }
    o += `<g data-vdoc="${it.x.d.id}" class="vzdoc"><circle cx="${lx}" cy="${ly}" r="12" fill="transparent"/><text class="${isSel ? "vz-lbl-s" : "vz-text"}" x="${lx}" y="${ly + 4}" text-anchor="middle">D${it.x.rank}</text></g>`;
    return o;
  };
  items
    .filter((it) => it.x.d.id !== sel.d.id)
    .forEach((it) => (s += drawDoc(it, false)));
  const si = items.find((it) => it.x.d.id === sel.d.id);
  // sudut terpilih
  const r0 = 64,
    [ex, ey] = P(si.p, r0),
    [mx, my] = P(si.p / 2, r0 + 24);
  s += `<path class="vz-ang" d="M${ox},${oy} L${ox + r0},${oy} A${r0},${r0} 0 0 0 ${ex},${ey} Z"/>`;
  s += `<text class="vz-lbl-s" x="${Math.max(mx, ox + 70)}" y="${my + (si.p > 60 ? 24 : 4)}">θ = ${si.a.toFixed(1)}°</text>`;
  if (!zoom) {
    const [tx, ty] = P(si.p, R);
    s += `<line class="vz-guide" x1="${tx}" y1="${ty}" x2="${tx}" y2="${oy}"/><text class="vz-lbl-s small" x="${tx}" y="${oy + 18}" text-anchor="middle">cos θ = ${f4(sel.s)}</text>`;
  }
  s += drawDoc(si, true);
  s += `<line class="vz-q" x1="${ox}" y1="${oy}" x2="${ox + R}" y2="${oy}" marker-end="url(#vz-f-q)"/><text class="vz-lbl-q" x="${ox + R + 8}" y="${oy + 5}">q</text>`;
  if (zoom)
    s += `<text class="vz-tick" x="${W - 8}" y="${H - 6}" text-anchor="end">skala sudut diperbesar</text>`;
  return s + "</svg>";
}

/* Gambar 3: batang bobot (HTML) */
function barsDoc(sel, T) {
  const d = sel.d,
    m = new Map([...d.w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
  T.forEach((t) => {
    if (!m.has(t)) m.set(t, d.w.get(t) || 0);
  });
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map((r) => r[1]), 1e-9);
  return rows
    .map(
      ([t, w]) =>
        `<div class="hbar${cur.qw.has(t) ? " q" : ""}"><span class="hl">${esc(t)}</span><span class="ht"><i style="width:${((w / max) * 100).toFixed(1)}%"></i></span><span class="hv">${f4(w)}</span></div>`,
    )
    .join("");
}
function barsDot(sel, T) {
  const d = sel.d,
    pr = T.map((t) => ({ t, a: cur.qw.get(t), b: d.w.get(t) || 0 })).map(
      (r) => ({ ...r, p: r.a * r.b }),
    );
  const max = Math.max(...pr.map((r) => r.p), 1e-9),
    tot = pr.reduce((a, r) => a + r.p, 0);
  return (
    pr
      .map(
        (r) =>
          `<div class="hbar q"><span class="hl">${esc(r.t)}</span><span class="ht"><i style="width:${((r.p / max) * 100).toFixed(1)}%"></i></span><span class="hv wide">${f4(r.a)} × ${f4(r.b)} = ${f4(r.p)}</span></div>`,
      )
      .join("") +
    `<div class="hbar tot"><span class="hl">Σ = q · d</span><span class="ht"></span><span class="hv wide">${f4(tot)}</span></div>`
  );
}

function tabVisual() {
  if (!cur.qw.size) return noQ();
  const D = calcDocs(),
    T = [...cur.qw.keys()],
    V = S.idx.df.size;
  const { sel, html } = docSelect(D);
  const angs = D.map(angleOf),
    spread = Math.max(...angs) - Math.min(...angs);
  const zoom = cs.zoom === null ? spread < 20 : cs.zoom;
  if (!cs.ax || cs.ax[0] >= T.length || cs.ax[1] >= T.length)
    cs.ax = [0, Math.min(1, T.length - 1)];
  if (T.length >= 2 && cs.ax[0] === cs.ax[1])
    cs.ax[1] = (cs.ax[0] + 1) % T.length;
  const optX = (i) =>
    T.map(
      (t, k) =>
        `<option value="${k}"${k === cs.ax[i] ? " selected" : ""}>${esc(t)}</option>`,
    ).join("");
  const key = `<div class="vzkey"><span><i class="k q"></i> vektor kueri q</span><span><i class="k s"></i> dokumen terpilih</span><span><i class="k d"></i> dokumen lain</span></div>`;

  const plane =
    T.length >= 2
      ? `<div class="ctl"><label class="docsel">Sumbu X: <select id="axX">${optX(0)}</select></label><label class="docsel">Sumbu Y: <select id="axY">${optX(1)}</select></label></div>
         <div class="vzbox">${svgPlane(D, sel, T[cs.ax[0]], T[cs.ax[1]])}</div>${key}
         <p class="muted">Gambar ini hanya memperlihatkan <b>2 dari ${NF.format(V)} dimensi</b> (proyeksi). Dimensi lain tidak tampak tetapi tetap ikut menentukan norma |d| dan sudut sebenarnya (gambar 2).</p>`
      : `<p class="muted">Kueri hanya memuat satu term (“${esc(T[0])}”), jadi bidang dua sumbu tidak bisa digambar. Coba kueri dengan dua kata atau lebih.</p>`;

  const legendRows = D.map(
    (x, i) =>
      `<tr data-doc="${x.d.id}" class="${x.d.id === sel.d.id ? "sel" : ""}"><td class="l"><b>D${x.rank}</b> <small>ID ${x.d.id}</small></td><td>${f4(x.s)}</td><td>${angs[i].toFixed(1)}°</td></tr>`,
  ).join("");

  return `
  <p>Cara paling mudah membayangkan VSM: <b>setiap term adalah satu sumbu</b>, dan setiap dokumen maupun kueri adalah <b>panah (vektor)</b> dari titik asal. Semakin searah panah dokumen dengan panah kueri, semakin mirip.</p>
  <div class="ctl">${html}</div>

  <h4 class="calc-sec">1. Ruang vektor: dokumen dan kueri sebagai panah</h4>
  ${plane}

  <h4 class="calc-sec">2. Sudut antara kueri dan dokumen = cosine similarity</h4>
  <div class="ctl"><button type="button" class="ghost sm" data-zoom="1">${zoom ? "Tampilkan sudut sebenarnya" : "Perbesar selisih sudut"}</button><span class="muted">${zoom ? "Skala sudut diperbesar agar selisih antar dokumen terlihat; sudut asli ada di tabel." : `Sudut asli antar dokumen hanya berbeda ${spread.toFixed(1)}°${spread < 20 ? "; gunakan tombol perbesar jika panah terlalu rapat." : "."}`}</span></div>
  <div class="vzflex">
    <div class="vzbox">${svgFan(D, sel, zoom)}</div>
    <div class="sc vzlegend"><table><thead><tr><th class="l">Dokumen</th><th>cos θ</th><th>θ</th></tr></thead><tbody>${legendRows}</tbody></table></div>
  </div>
  ${key}
  <p class="muted">Semua bobot TF-IDF ≥ 0, sehingga sudut selalu antara <b>0°</b> (searah, paling mirip) dan <b>90°</b> (tegak lurus, tidak ada term yang sama). Panjang vektor tidak memengaruhi cosine, maka dokumen digambar sama panjang (vektor satuan).${zoom ? "" : " Garis putus-putus vertikal menunjukkan bahwa <b>cos θ</b> = panjang bayangan vektor dokumen pada sumbu q."} Klik label atau baris untuk memilih dokumen.</p>

  <h4 class="calc-sec">3. Isi vektor dokumen terpilih (D${sel.rank})</h4>
  <p class="muted">Bobot terbesar pada vektor dokumen (batang hijau = term yang juga ada di kueri).</p>
  <div class="hbars">${barsDoc(sel, T)}</div>
  <p class="muted" style="margin-top:14px">Hanya term yang ada di <b>kueri dan dokumen sekaligus</b> yang menyumbang ke dot product (q · d):</p>
  <div class="hbars">${barsDot(sel, T)}</div>`;
}

/* ---------- Tab 4: langkah hitung cosine similarity ---------- */
function tabCosine() {
  if (!cur.qw.size) return noQ();
  const D = calcDocs(),
    T = [...cur.qw.keys()],
    qn = qNorm();
  const dotOf = (d) =>
    T.reduce((a, t) => a + cur.qw.get(t) * (d.w.get(t) || 0), 0);
  const { sel, html } = docSelect(D);
  const d = sel.d,
    dot = dotOf(d),
    den = qn * d.norm,
    cos = den ? dot / den : 0;

  const sum = D.map((x) => {
    const dt = dotOf(x.d),
      dn = qn * x.d.norm;
    return `<tr data-doc="${x.d.id}" class="${x.d.id === d.id ? "sel" : ""}"><td class="l"><b>D${x.rank}</b> <small>${esc(shortTxt(x.d.title, 46))}</small></td><td>${f6(dt)}</td><td>${f4(qn)}</td><td>${f4(x.d.norm)}</td><td>${f6(dn)}</td><td><b>${f6(dn ? dt / dn : 0)}</b></td></tr>`;
  }).join("");

  // langkah 1: dot product
  const r1 = T.map((t) => {
    const a = cur.qw.get(t),
      b = d.w.get(t) || 0;
    return `<tr><td class="l">${esc(t)}</td><td>${f6(a)}</td><td>${f6(b)}</td><td>${f6(a * b)}</td></tr>`;
  }).join("");
  // langkah 2: norma kueri
  const r2 = T.map(
    (t) =>
      `<tr><td class="l">${esc(t)}</td><td>${f6(cur.qw.get(t))}</td><td>${f6(cur.qw.get(t) ** 2)}</td></tr>`,
  ).join("");
  const sq = T.reduce((a, t) => a + cur.qw.get(t) ** 2, 0);
  // langkah 3: norma dokumen
  const totalSq = d.norm * d.norm,
    qPart = T.reduce((a, t) => a + (d.w.get(t) || 0) ** 2, 0),
    rest = Math.max(0, totalSq - qPart),
    n = [...d.w.values()].filter((x) => x > 0).length,
    k = T.filter((t) => (d.w.get(t) || 0) > 0).length;
  const r3 = T.map(
    (t) =>
      `<tr><td class="l">${esc(t)}</td><td>${f6(d.w.get(t) || 0)}</td><td>${f6((d.w.get(t) || 0) ** 2)}</td></tr>`,
  ).join("");
  const ok = Math.abs(cos - sel.s) < 1e-9;

  return `
  <div class="formula">
    <b>cos(q, d)</b> = (q · d) / ( |q| × |d| )<br>
    <b>q · d</b> = Σ ( w<sub>q,t</sub> × w<sub>d,t</sub> ) &nbsp;·&nbsp; <b>|v|</b> = √( Σ w² )
  </div>
  <h4 class="calc-sec">Ringkasan perhitungan 10 dokumen teratas</h4>
  <p class="muted">Klik baris untuk melihat langkah rinci dokumen tersebut.</p>
  <div class="sc"><table><thead><tr><th class="l">Dokumen</th><th>q · d</th><th>|q|</th><th>|d|</th><th>|q| × |d|</th><th>cos(q, d)</th></tr></thead><tbody>${sum}</tbody></table></div>

  <h4 class="calc-sec">Langkah rinci dokumen terpilih</h4>
  <div class="ctl">${html}</div>
  <p class="muted"><b>D${sel.rank}</b> · ${esc(d.title)}</p>

  <div class="step"><h5>Langkah 1 — Dot product (q · d)</h5>
    <div class="sc"><table><thead><tr><th class="l">Term</th><th>w<sub>q</sub></th><th>w<sub>d</sub></th><th>w<sub>q</sub> × w<sub>d</sub></th></tr></thead><tbody>${r1}</tbody>
    <tfoot><tr><td class="l">Σ = q · d</td><td></td><td></td><td>${f6(dot)}</td></tr></tfoot></table></div>
  </div>

  <div class="step"><h5>Langkah 2 — Norma kueri |q|</h5>
    <div class="sc"><table><thead><tr><th class="l">Term</th><th>w<sub>q</sub></th><th>w<sub>q</sub>²</th></tr></thead><tbody>${r2}</tbody>
    <tfoot><tr><td class="l">Σ w² = ${f6(sq)}</td><td></td><td></td></tr></tfoot></table></div>
    <div class="eq">|q| = √${f6(sq)} = <b>${f6(qn)}</b></div>
  </div>

  <div class="step"><h5>Langkah 3 — Norma dokumen |d|</h5>
    <div class="sc"><table><thead><tr><th class="l">Dimensi</th><th>w<sub>d</sub></th><th>w<sub>d</sub>²</th></tr></thead><tbody>${r3}
      <tr><td class="l">${NF.format(Math.max(0, n - k))} dimensi tak-nol lainnya</td><td></td><td>${f6(rest)}</td></tr></tbody>
    <tfoot><tr><td class="l">Σ w² (seluruh ${NF.format(n)} dimensi tak-nol)</td><td></td><td>${f6(totalSq)}</td></tr></tfoot></table></div>
    <div class="eq">|d| = √${f6(totalSq)} = <b>${f6(d.norm)}</b> <span class="muted">· rincian seluruh dimensi ada di tab Vektor VSM</span></div>
  </div>

  <div class="step"><h5>Langkah 4 — Cosine similarity</h5>
    <div class="eq big">cos(q, d) = ${f6(dot)} / ( ${f6(qn)} × ${f6(d.norm)} ) = ${f6(dot)} / ${f6(den)} = <b>${f6(cos)}</b></div>
    <p class="muted">${ok ? "✓ Sama dengan skor pada daftar hasil" : "Selisih dengan skor daftar hasil"} (${f4(sel.s)}), sehingga D${sel.rank} berada di peringkat ${sel.rank}${cat === "ALL" ? "" : " dalam kategori terpilih"}.</p>
  </div>`;
}

/* ---------- Render & kontrol jendela ---------- */
function renderCalc(keepScroll) {
  const body = $("calcBody"),
    st = body.scrollTop;
  document
    .querySelectorAll("#calcTabs button")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.tab === cs.tab)),
    );
  body.innerHTML = {
    koleksi: tabKoleksi,
    matriks: tabMatriks,
    vektor: tabVektor,
    visual: tabVisual,
    cosine: tabCosine,
  }[cs.tab]();
  if (cs.tab === "koleksi") drawTermTable();
  body.scrollTop = keepScroll ? st : 0;
}

function openCalc(tab, docId) {
  if (!cur) return;
  cs.tab = tab || "koleksi";
  if (docId) cs.docId = docId;
  closeSidebar();
  const lab = cat === "ALL" ? "" : ` · kategori ${cur.facets.get(cat).label}`;
  $("calcQ").innerHTML =
    `Kueri “${esc(cur.text)}” → ${chips(cur.p.e)}<span class="muted"> · 10 dokumen teratas${esc(lab)}</span>`;
  renderCalc();
  const dlg = $("calc");
  if (!dlg.open) {
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    document.body.style.overflow = "hidden";
  }
}

$("calc").addEventListener("close", () => {
  document.body.style.overflow = "";
});
$("calcClose").onclick = () => $("calc").close();
$("calc").addEventListener("click", (e) => {
  if (e.target === $("calc")) $("calc").close();
});
$("calcTabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) {
    cs.tab = b.dataset.tab;
    renderCalc();
  }
});
$("calcBody").addEventListener("input", (e) => {
  if (e.target.id === "tq") {
    cs.tq = e.target.value;
    cs.tp = 1;
    drawTermTable();
  }
});
$("calcBody").addEventListener("change", (e) => {
  if (e.target.id === "ts") {
    cs.ts = e.target.value;
    cs.tp = 1;
    drawTermTable();
  }
  if (e.target.id === "docSel") {
    cs.docId = +e.target.value;
    renderCalc(true);
  }
  if (e.target.id === "axX" || e.target.id === "axY") {
    cs.ax = [+$("axX").value, +$("axY").value];
    renderCalc(true);
  }
});
$("calcBody").addEventListener("click", (e) => {
  const o = e.target.closest("button[data-tonly]");
  if (o) {
    cs.tonly = o.dataset.tonly === "1";
    cs.tp = 1;
    document
      .querySelectorAll("#calcBody [data-tonly]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String((b.dataset.tonly === "1") === cs.tonly),
        ),
      );
    drawTermTable();
    return;
  }
  const p = e.target.closest("button[data-tp]");
  if (p && !p.disabled) {
    cs.tp = +p.dataset.tp;
    drawTermTable();
    return;
  }
  const z = e.target.closest("button[data-zoom]");
  if (z) {
    const cur0 = cs.zoom === null ? null : cs.zoom;
    const angs = calcDocs().map(angleOf),
      spread = Math.max(...angs) - Math.min(...angs);
    cs.zoom = !(cur0 === null ? spread < 20 : cur0);
    renderCalc(true);
    return;
  }
  const v = e.target.closest("g[data-vdoc]");
  if (v) {
    cs.docId = +v.dataset.vdoc;
    renderCalc(true);
    return;
  }
  const r = e.target.closest("tr[data-doc]");
  if (r) {
    cs.docId = +r.dataset.doc;
    renderCalc(true);
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-calc]");
  if (b && cur) openCalc(b.dataset.calc, b.dataset.doc ? +b.dataset.doc : null);
});

/* ---------- Log ---------- */
$("logclear").onclick = () => {
  LOG.length = 0;
  $("logbody").textContent = "";
};
$("logcopy").onclick = () => {
  const b = $("logcopy");
  try {
    navigator.clipboard.writeText(LOG.join("\n")).then(
      () => {
        b.textContent = "Tersalin";
      },
      () => {
        b.textContent = "Gagal";
      },
    );
  } catch (e) {
    b.textContent = "Gagal";
  }
  setTimeout(() => {
    b.textContent = "Salin";
  }, 1500);
};
