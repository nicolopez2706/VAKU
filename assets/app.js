/* =========================================================
   VAKU Estudio · tienda
   Lee el catálogo desde Google Sheets (o desde /data si no hay
   conexión) y maneja carrito, códigos y pedido por WhatsApp.
   ========================================================= */
(() => {
  "use strict";

  const CFG = window.VAKU_CONFIG || {};
  const TABS = Object.assign({ productos: "Productos", codigos: "Codigos", ajustes: "Ajustes", galeria: "Galeria" }, CFG.tabs || {});
  const PAGE = 12; // collares que se muestran antes de "Ver más"
  const ELEMENTS = ["Fuego", "Agua", "Aire", "Tierra"];
  const THREAD_COLORS = {
    negro: "#1c1a1a", "marron chocolate": "#3f2a20", "marron dulce de leche": "#b67a3c", "marron tierra": "#7a5137",
    beige: "#e7dcc8", gris: "#9d9c99", violeta: "#8a63b6", azul: "#2350c9", rojo: "#c0332b",
    marron: "#6b4a33", suela: "#b07a4a", natural: "#e7dcc8", blanco: "#f4f1ec", verde: "#5f7552",
    celeste: "#8fb3c9", amarillo: "#e2b23a", naranja: "#d77a3a", rosa: "#d99aa3", bordo: "#6e1f2a",
    crema: "#efe4cf", plata: "#b9b9b6", dorado: "#c9a24a", terracota: "#b8603e", moteado: "radial-gradient(circle at 30% 30%, #3a2d24 18%, transparent 20%), radial-gradient(circle at 70% 65%, #3a2d24 16%, transparent 18%), #efe4cf",
    lila: "#b8a6cc", turquesa: "#4f9a99", mostaza: "#c99a2e", tostado: "#a07a52",
  };
  const list = (v) => String(v || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const swatch = (name) => THREAD_COLORS[norm(name)] || THREAD_COLORS[norm(name).split(" ")[0]] || "#b9a894";
  const PLACEHOLDER = "img/piezas-crudas.webp";
  const CART_KEY = "vaku-cart-v1";
  const CODE_KEY = "vaku-code-v1";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    products: [],
    codes: [],
    settings: {},
    filter: "all",
    cart: load(CART_KEY, []),
    code: load(CODE_KEY, null),
  };

  /* ---------------- utilidades ---------------- */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  }
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const truthy = (v) => ["true", "si", "sí", "x", "1", "verdadero", "yes"].includes(norm(v));
  function toNumber(v) {
    if (v == null) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;
    s = s.replace(/[^\d,.-]/g, "");
    // "25.000" o "25.000,50" (formato AR) -> 25000 / 25000.5
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function parseDate(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      return new Date(y, +m[2] - 1, +m[1], 23, 59, 59);
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
    m = s.match(/^Date\((\d+),(\d+),(\d+)/); // formato gviz
    if (m) return new Date(+m[1], +m[2], +m[3], 23, 59, 59);
    return null;
  }

  /* Convierte links de Google Drive en una URL de imagen directa */
  function imageUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const m = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/) ||
              s.match(/docs\.google\.com\/uc\?(?:[^#]*&)?id=([\w-]{20,})/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1400`;
    return s;
  }
  function driveFallback(url) {
    const m = String(url).match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1400` : "";
  }
  // si una imagen de Drive falla, probamos con la otra URL de Drive
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.getAttribute("src") || img.dataset.fallback === "2") return;
    const alt = !img.dataset.fallback && driveFallback(img.src);
    // si tampoco carga (foto borrada o sin permiso), mostramos una foto genérica en vez de un ícono roto
    if (alt) { img.dataset.fallback = "1"; img.src = alt; }
    else { img.dataset.fallback = "2"; img.src = PLACEHOLDER; }
  }, true);

  /* CSV robusto (comillas, saltos de línea dentro de celdas) */
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift().map((h) => slug(h));
    return rows
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
  }

  async function fetchTab(tab, localFile) {
    if (CFG.sheetId) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}&_=${Math.floor(Date.now() / 60000)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        const text = await res.text();
        if (/^\s*<|google\.visualization/i.test(text)) throw new Error("respuesta no CSV");
        return { rows: parseCSV(text), source: "sheet" };
      } catch (err) {
        console.warn(`[VAKU] No se pudo leer la pestaña "${tab}" de Google Sheets, uso datos locales.`, err);
      }
    }
    const res = await fetch(localFile, { cache: "no-store" });
    return { rows: parseCSV(await res.text()), source: "local" };
  }

  /* ---------------- datos ---------------- */
  function buildSettings(rows) {
    const map = {};
    rows.forEach((r) => {
      const k = norm(r.ajuste);
      const v = r.valor ?? "";
      if (k.startsWith("whatsapp")) map.whatsapp = String(v).replace(/\D/g, "");
      else if (k.startsWith("instagram")) map.instagram = String(v).replace(/^@/, "").trim();
      else if (k.includes("barra") || k.includes("anuncio")) map.announce = v;
      else if (k.startsWith("elemento")) map.weekly = ELEMENTS.find((e) => norm(e) === norm(v)) || "";
      else if (k.startsWith("descuento")) map.weeklyPct = Math.max(0, Math.min(90, toNumber(v) || 0));
      else if (k.includes("mercado") || k.includes("alias")) map.alias = v;
      else if (k.startsWith("envio")) map.shipping = v;
      else if (k.includes("hilo") && k.includes("agotad")) map.threadsOut = list(v);
      else if (k.includes("hilo")) map.threads = list(v);
    });
    return map;
  }

  function buildProducts(rows) {
    // El id sale del nombre (no de la fila), así el carrito guardado no se mezcla si se agregan o mueven filas
    const seen = {};
    const makeId = (name) => { const b = slug(name) || "p"; seen[b] = (seen[b] || 0) + 1; return seen[b] > 1 ? `${b}-${seen[b]}` : b; };
    return rows
      .filter((r) => r.nombre && (r.mostrar === undefined || truthy(r.mostrar)))
      .map((r, i) => {
        const name = r.nombre || "";
        const price = toNumber(r.precio);
        const sale = toNumber(r["precio-oferta"]);
        const el = ELEMENTS.find((e) => norm(e) === norm(r.elemento)) || "";
        const estado = r.estado || "Disponible";
        return {
          id: makeId(name),
          name,
          desc: r.descripcion || "",
          price: Number.isFinite(price) && price > 0 ? price : null,
          sale: Number.isFinite(sale) && sale > 0 ? sale : null,
          element: el,
          status: estado,
          soldOut: norm(estado) === "agotado",
          featured: truthy(r.destacado),
          images: Array.from({ length: 10 }, (_, n) => imageUrl(r["foto-" + (n + 1)])).filter(Boolean),
          order: Number.isFinite(toNumber(r.orden)) ? toNumber(r.orden) : 999 + i,
          idx: i,
        };
      })
      .sort((a, b) => (b.featured - a.featured) || (a.order - b.order) || (a.idx - b.idx));
  }

  function buildCodes(rows) {
    return rows
      .map((r) => ({
        active: r.activo === undefined ? true : truthy(r.activo),
        code: String(r.codigo || "").trim().toUpperCase(),
        type: norm(r.tipo).startsWith("monto") ? "amount" : "percent",
        value: toNumber(r.valor) || 0,
        min: toNumber(r["compra-minima"]) || 0,
        until: parseDate(r.vence),
      }))
      .filter((c) => c.code && c.value > 0);
  }

  /* Precio final de un producto (oferta propia > elemento de la semana > precio) */
  function pricing(p) {
    if (p.price == null) return { final: null, original: null, pct: 0, reason: "" };
    if (p.sale && p.sale < p.price) {
      return { final: p.sale, original: p.price, pct: Math.round((1 - p.sale / p.price) * 100), reason: "oferta" };
    }
    const s = state.settings;
    if (s.weekly && s.weeklyPct > 0 && p.element === s.weekly) {
      return { final: Math.round(p.price * (1 - s.weeklyPct / 100)), original: p.price, pct: s.weeklyPct, reason: "semana" };
    }
    return { final: p.price, original: null, pct: 0, reason: "" };
  }

  function priceHTML(p) {
    const pr = pricing(p);
    if (pr.final == null) return `<span class="price">Consultar</span>`;
    if (pr.original) return `<span class="price price--sale"><s>${money(pr.original)}</s><ins>${money(pr.final)}</ins></span>`;
    return `<span class="price">${money(pr.final)}</span>`;
  }

  /* ---------------- render: colección ---------------- */
  const grid = $("#grid");

  function renderGrid(keep) {
    const all = state.products.filter((p) => state.filter === "all" || p.element === state.filter);
    if (!keep) state.shown = PAGE;
    const list = all.slice(0, state.shown);
    $("#gridEmpty").hidden = all.length > 0;
    const more = $("#gridMore");
    more.hidden = all.length <= list.length;
    more.textContent = `Ver más collares (${all.length - list.length})`;
    const start = keep ? grid.querySelectorAll(".card:not(.card--skeleton)").length : 0;
    const html = list.slice(start).map((p, j) => {
      const i = j;
      const pr = pricing(p);
      const badges = [];
      if (p.soldOut) badges.push(`<span class="badge badge--soldout">Agotado</span>`);
      else if (pr.pct) badges.push(`<span class="badge badge--sale">-${pr.pct}%</span>`);
      if (!p.soldOut && norm(p.status) !== "disponible") badges.push(`<span class="badge">${esc(p.status)}</span>`);
      if (p.element) badges.push(`<span class="badge badge--el">${esc(p.element)}</span>`);
      const img1 = p.images[0] || "img/piezas-crudas.webp";
      const img2 = p.images[1];
      const action = p.soldOut ? "Ver detalle" : p.price == null ? "Consultar" : "Ver y agregar";
      return `
        <article class="card${p.soldOut ? " is-soldout" : ""}" style="--d:${Math.min(i, 6) * 0.08}s" data-id="${esc(p.id)}">
          <div class="card__media" role="button" tabindex="0" aria-label="Ver ${esc(p.name)}">
            <img src="${esc(img1)}" alt="${esc(p.name)}" loading="lazy" />
            ${img2 ? `<img class="alt" src="${esc(img2)}" alt="" loading="lazy" />` : ""}
            <div class="card__badges">${badges.join("")}</div>
            <div class="card__quick"><span class="btn">${action}</span></div>
          </div>
          <div class="card__row">
            <h3 class="card__name">${esc(p.name)}</h3>
            ${priceHTML(p)}
          </div>
          <p class="card__desc">${esc(p.desc)}</p>
        </article>`;
    }).join("");
    if (keep) grid.insertAdjacentHTML("beforeend", html); else grid.innerHTML = html;
    observeCards();
  }
  $("#gridMore").addEventListener("click", () => { state.shown += PAGE; renderGrid(true); });

  function observeCards() {
    const cards = $$(".card:not(.card--skeleton):not(.is-in)", grid);
    if (reduceMotion || !("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    cards.forEach((c) => io.observe(c));
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card && e.target.closest(".card__media")) openModal(card.dataset.id);
  });
  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card__media")) {
      e.preventDefault();
      openModal(e.target.closest(".card").dataset.id);
    }
  });

  function setFilter(f, scroll) {
    state.filter = f;
    $$("#filters .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.filter === f));
    renderGrid();
    if (scroll) $("#coleccion").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }
  $("#filters").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) setFilter(b.dataset.filter); });
  $$(".element__link").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter, true)));
  $("#weeklyBtn").addEventListener("click", () => setFilter(state.settings.weekly || "all", true));

  /* ---------------- modal de producto ---------------- */
  const modal = $("#modal");
  let current = null, qty = 1, thread = "", imgs = [], imgIdx = 0;

  // Botones de color: los agotados quedan tachados y no se pueden elegir
  function swatchesHTML(items, outList) {
    const out = (outList || []).map(norm);
    return items.map((t) => {
      const off = out.includes(norm(t));
      return `<button type="button" data-t="${esc(t)}" style="--sw:${swatch(t)}"${off ? ' disabled aria-disabled="true" title="Agotado"' : ""}><i></i>${esc(t)}${off ? " <small>agotado</small>" : ""}</button>`;
    }).join("");
  }
  function pick(wrapSel, value) {
    $$(wrapSel + " button").forEach((x) => x.classList.toggle("is-active", x.dataset.t === value));
  }

  function openModal(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    current = p; qty = 1;
    const threads = state.settings.threads || [];
    const threadsOut = (state.settings.threadsOut || []).map(norm);
    thread = threads.find((t) => !threadsOut.includes(norm(t))) || "";
    imgs = p.images.length ? p.images : ["img/piezas-crudas.webp"];
    $("#modalImg").alt = p.name;
    $("#modalThumbs").innerHTML = imgs.length > 1
      ? imgs.map((src, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy" /></button>`).join("")
      : "";
    $$(".modal__nav").forEach((b) => { b.hidden = imgs.length < 2; });
    showImg(0);
    $("#modalEl").textContent = [p.element, p.status].filter(Boolean).join(" · ");
    $("#modalTitle").textContent = p.name;
    const pr = pricing(p);
    $("#modalPrice").innerHTML = priceHTML(p) + (pr.reason === "semana" ? ` <span class="badge badge--sale">Elemento de la semana</span>` : "");
    $("#modalDesc").textContent = p.desc;
    $("#modalThreadWrap").hidden = !threads.length || p.soldOut;
    $("#modalThreads").innerHTML = swatchesHTML(threads, threadsOut);
    pick("#modalThreads", thread);
    $("#qtyVal").textContent = qty;
    const add = $("#modalAdd");
    add.disabled = p.soldOut;
    add.textContent = p.soldOut ? "Agotado" : p.price == null ? "Consultar por WhatsApp" : "Agregar al carrito";
    $(".modal__actions .qty").hidden = p.soldOut || p.price == null;
    $("#modalStatus").textContent = norm(p.status) === "a pedido" ? "Se hace a pedido: lo modelamos para vos y coordinamos los tiempos por WhatsApp." : "";
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
  }
  function closeModal() { if (modal.open) modal.close(); }

  function showImg(i) {
    imgIdx = (i + imgs.length) % imgs.length;
    const img = $("#modalImg");
    img.src = imgs[imgIdx];
    img.style.animation = "none"; void img.offsetWidth; img.style.animation = "";
    $$("#modalThumbs button").forEach((x, n) => x.classList.toggle("is-active", n === imgIdx));
    const t = $$("#modalThumbs button")[imgIdx];
    if (t) t.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    $("#modalCount").textContent = imgs.length > 1 ? `${imgIdx + 1} / ${imgs.length}` : "";
  }
  $("#modalThumbs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (b) showImg(+b.dataset.i);
  });
  $("#modalPrev").addEventListener("click", () => showImg(imgIdx - 1));
  $("#modalNext").addEventListener("click", () => showImg(imgIdx + 1));
  swipe($(".modal__main"), (dir) => imgs.length > 1 && showImg(imgIdx + dir));

  // Deslizar con el dedo: llama a cb(1) o cb(-1)
  function swipe(el, cb) {
    let x0 = null, y0 = 0;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) cb(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }
  $("#modalThreads").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    thread = b.dataset.t;
    pick("#modalThreads", thread);
  });
  $("#qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); $("#qtyVal").textContent = qty; });
  $("#qtyPlus").addEventListener("click", () => { qty = Math.min(20, qty + 1); $("#qtyVal").textContent = qty; });
  $("#modalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  $("#modalAdd").addEventListener("click", (e) => {
    if (!current) return;
    if (current.price == null) {
      window.open(waLink(`¡Hola VAKU! Quería consultar por el collar ${current.name}.`), "_blank", "noopener");
      return;
    }
    addToCart(current, qty, thread, "", e.currentTarget);
    closeModal();
  });

  /* ---------------- carrito ---------------- */
  function cartLines() {
    return state.cart
      .map((l) => {
        const p = state.products.find((x) => x.id === l.id);
        if (!p || p.soldOut || p.price == null) return null;
        const unit = pricing(p).final;
        return { ...l, p, unit, total: unit * l.qty };
      })
      .filter(Boolean);
  }

  function addToCart(p, n, t, c, fromEl) {
    const key = p.id + "|" + (c || "") + "|" + (t || "");
    const found = state.cart.find((l) => l.key === key);
    if (found) found.qty = Math.min(20, found.qty + n);
    else state.cart.push({ key, id: p.id, qty: n, thread: t || "", color: c || "" });
    save(CART_KEY, state.cart);
    flyToCart(fromEl);
    renderCart();
    toast(`${p.name} se agregó al carrito`);
  }

  function flyToCart(fromEl) {
    const btn = $("#cartBtn");
    const bump = () => { btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); };
    if (reduceMotion || !fromEl || !fromEl.getBoundingClientRect) return bump();
    const a = fromEl.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "fly-dot";
    document.body.appendChild(dot);
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    const anim = dot.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 120}px) scale(1.4)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${ex}px, ${ey}px) scale(0.4)`, opacity: 0.6 },
    ], { duration: 800, easing: "cubic-bezier(.5,0,.3,1)" });
    dot.style.left = "-7px"; dot.style.top = "-7px";
    anim.onfinish = () => { dot.remove(); bump(); };
  }

  function lineOpts(l) {
    return [l.color && "Color " + l.color, l.thread && "Hilo " + l.thread].filter(Boolean).join(", ");
  }

  function discountFor(subtotal) {
    const c = state.code && state.codes.find((x) => x.code === state.code);
    if (!c) return { amount: 0, code: null };
    const err = codeError(c, subtotal);
    if (err) return { amount: 0, code: c, err };
    const amount = c.type === "amount" ? Math.min(c.value, subtotal) : Math.round(subtotal * Math.min(c.value, 100) / 100);
    return { amount, code: c };
  }
  function codeError(c, subtotal) {
    if (!c.active) return "Este código no está activo.";
    if (c.until && c.until < new Date()) return "Este código ya venció.";
    if (c.min && subtotal < c.min) return `Este código es para compras desde ${money(c.min)}.`;
    return "";
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.qty, 0);
    $("#cartCount").textContent = count;
    const body = $("#cartItems");
    if (!lines.length) {
      body.innerHTML = `<div class="drawer__empty"><em>Todavía vacío</em>Elegí tu collar y encontrá tu energía.</div>`;
      $("#cartFoot").hidden = true;
      return;
    }
    $("#cartFoot").hidden = false;
    body.innerHTML = lines.map((l) => `
      <div class="line-item" data-key="${esc(l.key)}">
        <img src="${esc(l.p.images[0] || "img/piezas-crudas.webp")}" alt="" />
        <div>
          <h3>${esc(l.p.name)}</h3>
          <small>${lineOpts(l) ? esc(lineOpts(l)) + " · " : ""}${money(l.unit)} c/u</small>
          <div class="qty"><button type="button" data-act="minus" aria-label="Menos">−</button><span>${l.qty}</span><button type="button" data-act="plus" aria-label="Más">+</button></div>
        </div>
        <div class="line-item__right">
          <strong>${money(l.total)}</strong>
          <button type="button" class="line-item__remove" data-act="remove">Quitar</button>
        </div>
      </div>`).join("");

    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const d = discountFor(subtotal);
    $("#subtotal").textContent = money(subtotal);
    $("#discountRow").hidden = !d.amount;
    $("#discountLabel").textContent = d.code ? `Código ${d.code.code}` : "Descuento";
    $("#discount").textContent = "-" + money(d.amount);
    $("#total").textContent = money(subtotal - d.amount);
    const msg = $("#codeMsg");
    if (d.code && d.err) { msg.textContent = d.err; msg.className = "code__msg err"; }
    else if (d.code) {
      msg.textContent = `Código ${d.code.code} aplicado: ${d.code.type === "amount" ? money(d.code.value) : d.code.value + "%"} de descuento.`;
      msg.className = "code__msg ok";
    }
  }

  $("#cartItems").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const key = b.closest(".line-item").dataset.key;
    const l = state.cart.find((x) => x.key === key); if (!l) return;
    if (b.dataset.act === "plus") l.qty = Math.min(20, l.qty + 1);
    if (b.dataset.act === "minus") l.qty -= 1;
    if (b.dataset.act === "remove" || l.qty < 1) state.cart = state.cart.filter((x) => x !== l);
    save(CART_KEY, state.cart);
    renderCart();
  });

  $("#codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("#codeInput").value.trim().toUpperCase();
    const msg = $("#codeMsg");
    if (!val) { state.code = null; save(CODE_KEY, null); msg.textContent = ""; renderCart(); return; }
    const c = state.codes.find((x) => x.code === val);
    if (!c || !c.active) { msg.textContent = "Ese código no existe o no está activo."; msg.className = "code__msg err"; return; }
    state.code = c.code;
    save(CODE_KEY, c.code);
    $("#codeInput").value = "";
    renderCart();
  });

  function openCart() {
    $("#drawer").classList.add("is-open");
    $("#drawer").setAttribute("aria-hidden", "false");
    $("#overlay").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    $("#drawer").classList.remove("is-open");
    $("#drawer").setAttribute("aria-hidden", "true");
    $("#overlay").classList.remove("is-open");
    document.body.style.overflow = "";
  }
  $("#cartBtn").addEventListener("click", openCart);
  $("#drawerClose").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); closeMenu(); } });

  /* ---------------- pedido por WhatsApp ---------------- */
  function waLink(text) {
    const n = state.settings.whatsapp;
    return `https://wa.me/${n || ""}?text=${encodeURIComponent(text)}`;
  }

  const checkout = $("#checkoutForm");
  checkout.addEventListener("submit", (e) => {
    e.preventDefault();
    const lines = cartLines();
    if (!lines.length) return;
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const d = discountFor(subtotal);
    const f = new FormData(checkout);
    const out = ["¡Hola VAKU! Quiero hacer este pedido:", ""];
    lines.forEach((l) => out.push(`• ${l.p.name}${lineOpts(l) ? ` (${lineOpts(l).toLowerCase()})` : ""} x${l.qty}: ${money(l.total)}`));
    out.push("", `Subtotal: ${money(subtotal)}`);
    if (d.amount) out.push(`Código ${d.code.code}: -${money(d.amount)}`);
    out.push(`*Total: ${money(subtotal - d.amount)}*`, "");
    out.push(`Nombre: ${f.get("nombre")}`);
    out.push(`Entrega: envío en Córdoba Capital, barrio ${f.get("barrio")} (a coordinar)`);
    if (String(f.get("notas") || "").trim()) out.push(`Notas: ${f.get("notas")}`);
    if (f.get("foto")) out.push("", "Antes de confirmar, quiero ver una foto de cómo queda el collar con el hilo elegido.");
    if (state.settings.alias) out.push("", `(Alias de Mercado Pago: ${state.settings.alias})`);
    if (!state.settings.whatsapp) console.warn("[VAKU] Falta el número de WhatsApp en la pestaña Ajustes de la planilla.");
    window.open(waLink(out.join("\n")), "_blank", "noopener");
  });

  /* ---------------- ajustes en la página ---------------- */
  function applySettings() {
    const s = state.settings;
    if (s.announce) {
      const parts = String(s.announce).split(/\s*[·|•]\s*/).filter(Boolean);
      const html = parts.map((p) => `<span>${esc(p)}</span>`).join("");
      $("#announceTrack").innerHTML = html.repeat(Math.max(2, Math.ceil(8 / parts.length)) * 2);
    } else {
      const t = $("#announceTrack"); t.innerHTML = t.innerHTML.repeat(4);
    }
    const ig = s.instagram || "vaku.estudio";
    ["#igLink", "#igFooter"].forEach((sel) => { $(sel).href = `https://www.instagram.com/${ig}/`; });
    $("#igLink").textContent = `Seguinos en Instagram · @${ig}`;
    const custom = waLink("¡Hola VAKU! Quiero hacer un collar a pedido. Mi idea es: ");
    $("#customBtn").href = custom;
    $("#waFooter").href = waLink("¡Hola VAKU!");
    if (s.shipping) { $("#shippingInfo").textContent = s.shipping; $("#shippingCart").textContent = s.shipping; }

    // elemento de la semana
    $$(".element").forEach((el) => {
      const tag = $(".element__week", el);
      const on = s.weekly && el.dataset.el === s.weekly;
      tag.hidden = !on;
      if (on) tag.textContent = s.weeklyPct ? `Elemento de la semana · -${s.weeklyPct}%` : "Elemento de la semana";
    });
    const weekly = $("#weekly");
    if (s.weekly) {
      weekly.hidden = false;
      $(".weekly__inner").style.setProperty("--c", `var(--${norm(s.weekly)})`);
      $("#weeklyTitle").textContent = s.weekly;
      $("#weeklyText").textContent = s.weeklyPct
        ? `Esta semana, todos los collares ${s.weekly.toUpperCase()} tienen ${s.weeklyPct}% OFF. Elegí tu favorito y encontrá tu energía.`
        : `Esta semana celebramos el elemento ${s.weekly.toLowerCase()}. Elegí tu favorito y encontrá tu energía.`;
      $("#weeklyBtn").textContent = `Ver collares ${s.weekly}`;
      observeReveals();
    } else weekly.hidden = true;
  }

  /* ---------------- animaciones generales ---------------- */
  function observeReveals() {
    const els = $$(".reveal:not(.is-in), .reveal-clip:not(.is-in), .element:not(.is-in)");
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
  }

  // Manifiesto: palabras que se encienden con el scroll
  const manifesto = $("#manifestoText");
  manifesto.innerHTML = manifesto.textContent.split(" ").map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
  const words = $$(".w", manifesto);

  // Parallax hero + manifiesto, nav con scroll
  const nav = $("#nav");
  const heroFigs = $$("#heroMedia [data-depth]");
  const maniImg = $(".manifesto__img img");
  let mx = 0, my = 0, ticking = false;

  function onFrame() {
    ticking = false;
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 30);
    if (reduceMotion) { words.forEach((w) => w.classList.add("on")); return; }
    const vh = window.innerHeight;
    if (y < vh * 1.5) {
      const sy = Math.min(y, vh);
      heroFigs.forEach((f) => {
        const d = parseFloat(f.dataset.depth);
        f.style.transform = `translate3d(${mx * d * 300}px, ${my * d * 300 - sy * d * 1.6}px, 0)`;
      });
    }
    const r = manifesto.getBoundingClientRect();
    const prog = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
    const lit = Math.round(prog * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < lit));
    if (maniImg) {
      const ir = maniImg.parentElement.getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, (ir.top + ir.height / 2 - vh / 2) / vh));
      maniImg.style.transform = `translate3d(0, ${p * -60 - 20}px, 0)`;
    }
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  window.addEventListener("mousemove", (e) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    request();
  }, { passive: true });

  // Cursor personalizado + botones magnéticos (solo con mouse)
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
    const cur = $(".cursor");
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", (e) => {
      cur.classList.toggle("is-hover", !!e.target.closest("a, button, .card__media, [role=button]"));
    });
    $$(".magnetic").forEach((b) => {
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      b.addEventListener("mouseleave", () => { b.style.transform = ""; });
    });
  }

  // Menú mobile
  const burger = $("#burger"), menu = $("#mobileMenu");
  function closeMenu() { menu.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; }
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$("a", menu).forEach((a) => a.addEventListener("click", closeMenu));

  // Toast
  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
  }

  $("#year").textContent = new Date().getFullYear();

  /* ---------------- galería "Mirá cómo queda" ---------------- */
  let lbIdx = 0;
  function buildGallery(rows) {
    return rows
      .map((r, i) => ({
        show: r.mostrar === undefined ? true : truthy(r.mostrar),
        src: imageUrl(r.foto),
        text: r.descripcion || "",
        order: Number.isFinite(toNumber(r.orden)) ? toNumber(r.orden) : 999 + i,
        idx: i,
      }))
      .filter((g) => g.show && g.src)
      .sort((a, b) => (a.order - b.order) || (a.idx - b.idx));
  }
  // Galería en filas que se desplazan solas (se pueden arrastrar; se frenan al pasar el mouse)
  const ASPECTS = ["4 / 5", "1 / 1", "3 / 4", "5 / 4", "4 / 5", "2 / 3"];
  let rows = [], lookRaf = 0, lookVisible = false, lastT = 0, lastScroll = window.scrollY, boost = 0;
  function lookCard(g, i, k, clone) {
    return `<figure class="look" data-i="${i}" style="--ar:${ASPECTS[k % ASPECTS.length]}" tabindex="${clone ? -1 : 0}" role="button" aria-label="Ampliar foto"${clone ? ' aria-hidden="true"' : ""}>
        <img src="${esc(g.src)}" alt="${esc(g.text || "Collar VAKU")}" loading="lazy" draggable="false" />
        ${g.text ? `<figcaption>${esc(g.text)}</figcaption>` : ""}
      </figure>`;
  }
  function renderLookbook() {
    const items = state.gallery || [];
    $("#galeria").hidden = !items.length;
    const mobile = window.matchMedia("(max-width: 560px)").matches;
    const nRows = items.length < 5 ? 1 : (items.length < 12 || mobile ? 2 : 3);
    const groups = Array.from({ length: nRows }, () => []);
    items.forEach((g, i) => groups[i % nRows].push(i));
    $("#lookGrid").innerHTML = groups.map((idxs, r) => {
      // Repetimos hasta cubrir la pantalla y duplicamos el bloque para que el loop no tenga cortes
      let set = idxs.slice();
      if (!reduceMotion) while (set.length < 7) set = set.concat(idxs);
      const one = set.map((i, k) => lookCard(items[i], i, k + r * 2, k >= idxs.length)).join("");
      const two = reduceMotion ? "" : set.map((i, k) => lookCard(items[i], i, k + r * 2, true)).join("");
      return `<div class="look-row reveal" style="--d:${r * 0.12}s"><div class="look-track">${one}${two}</div></div>`;
    }).join("");
    rows = $$("#lookGrid .look-row").map((el, r) => ({
      el, track: el.firstElementChild, x: 0, half: 0, fling: 0,
      dir: r % 2 ? 1 : -1, speed: 30 + r * 8, cur: 1, target: 1, drag: null, moved: false,
    }));
    rows.forEach(bindRow);
    measureRows();
    $$("#lookGrid img").forEach((img) => img.addEventListener("load", measureRows, { once: true }));
    observeReveals();
    startLook();
  }
  function measureRows() {
    rows.forEach((row) => { row.half = reduceMotion ? 0 : row.track.scrollWidth / 2; place(row); });
  }
  function place(row) {
    if (!row.half) return;
    // x siempre dentro de [-half, 0): al pasar el borde vuelve sin que se note
    row.x = ((row.x % row.half) - row.half) % row.half;
    row.track.style.transform = `translate3d(${row.x.toFixed(2)}px,0,0)`;
  }
  function bindRow(row) {
    const el = row.el;
    el.addEventListener("mouseenter", () => { row.target = 0.12; });
    el.addEventListener("mouseleave", () => { row.target = 1; });
    if (reduceMotion) return;
    el.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      row.drag = { x0: e.clientX, y0: e.clientY, start: row.x, id: e.pointerId, last: e.clientX, t: performance.now(), v: 0 };
      row.moved = false; row.fling = 0;
    });
    el.addEventListener("pointermove", (e) => {
      const d = row.drag; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0;
      if (!row.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - d.y0)) {
        row.moved = true; el.classList.add("is-drag");
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (row.moved) {
        const now = performance.now();
        d.v = (e.clientX - d.last) / Math.max(1, now - d.t) * 1000;
        d.last = e.clientX; d.t = now;
        row.x = d.start + dx; place(row);
      }
    });
    const end = (e) => {
      const d = row.drag; if (!d || d.id !== e.pointerId) return;
      if (row.moved) row.fling = Math.max(-2500, Math.min(2500, d.v));
      row.drag = null; el.classList.remove("is-drag");
      if (e.pointerType !== "mouse") row.target = 1;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    // si fue un arrastre, no abrir la foto
    el.addEventListener("click", (e) => { if (row.moved) { e.stopPropagation(); e.preventDefault(); row.moved = false; } }, true);
  }
  function lookTick(t) {
    lookRaf = 0;
    if (!lookVisible || reduceMotion || document.hidden) return;
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    const sy = window.scrollY; boost += Math.abs(sy - lastScroll) * 0.9; lastScroll = sy;
    boost *= 0.9; // al scrollear la página, las filas aceleran un poco
    rows.forEach((row) => {
      if (row.drag && row.moved) return;
      row.cur += (row.target - row.cur) * 0.06;
      row.x += (row.dir * (row.speed * row.cur + Math.min(boost, 400)) + row.fling) * dt;
      row.fling = Math.abs(row.fling) < 5 ? 0 : row.fling * 0.94;
      place(row);
    });
    lookRaf = requestAnimationFrame(lookTick);
  }
  function startLook() {
    if (!lookRaf && lookVisible && !reduceMotion) { lastT = 0; lastScroll = window.scrollY; lookRaf = requestAnimationFrame(lookTick); }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { lookVisible = es[0].isIntersecting; startLook(); }, { rootMargin: "120px" }).observe($("#galeria"));
  } else lookVisible = true;
  document.addEventListener("visibilitychange", startLook);
  let lookW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - lookW) < 40) return measureRows();
    lookW = window.innerWidth; if (state.gallery) renderLookbook();
  });
  const lb = $("#lightbox");
  function openLight(i) {
    lbIdx = i;
    showLight();
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }
  function showLight() {
    const items = state.gallery || [];
    lbIdx = (lbIdx + items.length) % items.length;
    const g = items[lbIdx];
    const img = $("#lbImg");
    img.src = g.src; img.alt = g.text || "Collar VAKU";
    img.style.animation = "none"; void img.offsetWidth; img.style.animation = "";
    $("#lbText").textContent = g.text;
    $("#lbCount").textContent = `${lbIdx + 1} / ${items.length}`;
  }
  $("#lookGrid").addEventListener("click", (e) => { const f = e.target.closest(".look"); if (f) openLight(+f.dataset.i); });
  $("#lookGrid").addEventListener("keydown", (e) => {
    const f = e.target.closest(".look");
    if (f && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLight(+f.dataset.i); }
  });
  $("#lbPrev").addEventListener("click", () => { lbIdx--; showLight(); });
  $("#lbNext").addEventListener("click", () => { lbIdx++; showLight(); });
  $("#lbClose").addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lightbox__stage")) lb.close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { lbIdx--; showLight(); }
    if (e.key === "ArrowRight") { lbIdx++; showLight(); }
  });
  swipe(lb, (dir) => { lbIdx += dir; showLight(); });
  modal.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" && imgs.length > 1) showImg(imgIdx - 1);
    if (e.key === "ArrowRight" && imgs.length > 1) showImg(imgIdx + 1);
  });

  /* ---------------- inicio ---------------- */
  function intro() {
    const loader = $("#loader");
    if (!loader || loader.classList.contains("is-done")) return;
    const done = () => {
      loader.classList.add("is-done");
      document.body.classList.add("is-loaded");
      setTimeout(() => loader.remove(), 1400);
    };
    if (reduceMotion) return done();
    setTimeout(done, 900);
  }

  async function init() {
    if (document.readyState === "complete") intro(); else window.addEventListener("load", intro, { once: true });
    setTimeout(() => document.body.classList.contains("is-loaded") || intro(), 3500);
    observeReveals();
    onFrame();
    renderCart();

    const [prod, codes, settings, gallery] = await Promise.all([
      fetchTab(TABS.productos, "data/productos.csv"),
      fetchTab(TABS.codigos, "data/codigos.csv").catch(() => ({ rows: [] })),
      fetchTab(TABS.ajustes, "data/ajustes.csv").catch(() => ({ rows: [] })),
      fetchTab(TABS.galeria, "data/galeria.csv").catch(() => ({ rows: [] })),
    ]).catch((err) => { console.error(err); return [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]; });

    state.settings = buildSettings(settings.rows);
    state.products = buildProducts(prod.rows);
    state.codes = buildCodes(codes.rows);
    document.documentElement.dataset.source = prod.source || "none";
    state.gallery = buildGallery(gallery.rows);
    applySettings();
    renderGrid();
    renderLookbook();
    renderCart();
  }

  init();
})();
