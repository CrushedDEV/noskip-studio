(() => {
  const C = window.NOSKIP || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';
  const root = document.documentElement;

  /* ---------- cartas de los juegos (van detrás de la del estudio, en la baraja) ---------- */
  const deck = $("#deck");
  const games = (C.games || []).filter((g) => g.name);
  deck.insertAdjacentHTML("beforeend", games.map((g, i) => {
    // "KAIROS: The Last Runner" → título grande "KAIROS" + subtítulo "The Last Runner"
    const [main, ...rest] = g.name.split(":");
    const sub = rest.join(":").trim();
    const color = g.color || ["#9b1df6", "#ff2bd6", "#2e5cff"][i % 3];
    const cover = g.cover
      ? '<img src="' + esc(g.cover) + '" alt="">'
      : '<span class="g-title">' + esc(main.trim()) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>";
    return '<article class="slot g-slot" data-i="' + (i + 1) + '" aria-label="' + esc(g.name) + '">' +
      '<div class="g-card" style="--c:' + esc(color) + '">' +
        '<div class="g-cover">' + cover + '<span class="g-num">' + String(i + 1).padStart(2, "0") + "/" + String(games.length).padStart(2, "0") + "</span></div>" +
        '<div class="g-body">' +
          '<p class="g-status">' + esc(g.status || "En desarrollo") + "</p>" +
          "<h2>" + esc(g.name) + "</h2>" +
          (g.text ? '<p class="g-text">' + esc(g.text) + "</p>" : "") +
          '<div class="g-foot">' +
            (g.genre ? '<span class="g-genre">' + esc(g.genre) + "</span>" : "<span></span>") +
            (g.url ? '<a class="g-link" href="' + esc(g.url) + '" target="_blank" rel="noopener">Ver ' + ARROW + "</a>" : "") +
          "</div>" +
        "</div>" +
      "</div></article>";
  }).join(""));

  /* ---------- contenido del reverso ---------- */
  // Equipo en una línea discreta: "Oihan — Game Designer & Developer · ..."
  $("#credits").innerHTML = (C.team || [])
    .map((p) => "<span><b>" + esc(p.name) + "</b>" + (p.role ? " — " + esc(p.role) : "") + "</span>").join(" &nbsp;·&nbsp; ");
  if (C.email) {
    $("#mail").textContent = C.email;
    $("#mail").href = "mailto:" + C.email;
  } else $("#mail").remove();
  $("#links").innerHTML = (C.links || []).filter((l) => l.url)
    .map((l) => '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + ARROW + "</a></li>").join("");

  /* ---------- la tarjeta como objeto 3D ---------- */
  const card = $("#card"), c3d = $("#card3d"), front = $("#front"), back = $("#back");
  const shadow = $("#shadow"), hintText = $("#hintText");
  const glossBands = [...document.querySelectorAll(".gloss i")];
  const holo = $(".holo"), holoBand = $(".holo i");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Canto: capas apiladas entre anverso y reverso (6 bastan y pesan la mitad)
  const DEPTH = parseFloat(getComputedStyle(root).getPropertyValue("--depth")) || 5;
  const LAYERS = 6;
  $("#edge").innerHTML = Array.from({ length: LAYERS }, (_, i) =>
    '<i style="transform:translateZ(' + (-DEPTH / 2 + (DEPTH * (i + .5)) / LAYERS).toFixed(2) + 'px)"></i>').join("");

  // Estado físico: ángulos (grados) y velocidades
  const S = { ry: 0, rx: 0, vy: 0, vx: 0, ty: 0, tx: 0, dragging: false, wob: 0 };
  let facingBack = false, running = false, lastT0 = 0, idleSince = 0, cur = 0;

  // Giroscopio (Android): la tarjeta se inclina con el móvil.
  // En iPhone haría falta pedir permiso con un aviso del sistema, así que ahí no se activa.
  const G = { x: 0, y: 0, tx: 0, ty: 0, on: false, b: null, g: null };
  if (!calm && "DeviceOrientationEvent" in window && typeof DeviceOrientationEvent.requestPermission !== "function"
      && matchMedia("(pointer: coarse)").matches) {
    addEventListener("deviceorientation", (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (G.b === null) { G.b = e.beta; G.g = e.gamma; }
      // el "centro" se va adaptando a cómo sujetas el móvil
      G.b += (e.beta - G.b) * 0.02;
      G.g += (e.gamma - G.g) * 0.02;
      G.tx = Math.max(-16, Math.min(16, (e.gamma - G.g) * 0.9));
      G.ty = Math.max(-12, Math.min(12, (e.beta - G.b) * 0.7));
      G.on = true;
    }, { passive: true });
  }

  // Solo se tocan transform y opacity: la gráfica del móvil lo mueve sin redibujar nada
  let lastHolo = -1;
  function render(t) {
    const w = calm ? 0 : S.wob * (G.on ? 0.35 : 1);
    const ry = S.ry + w * 3.2 * Math.sin(t / 1300) + G.x;
    const rx = S.rx + w * 2.4 * Math.sin(t / 1700 + 1) - G.y;
    c3d.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";

    const rad = (ry * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // la sombra se estrecha al ponerse de canto
    shadow.style.transform = "translate3d(0,16px,0) scaleX(" + (0.18 + 0.82 * Math.abs(cos)).toFixed(3) + ")";
    shadow.style.opacity = (0.55 + 0.45 * Math.abs(cos)).toFixed(3);
    // el brillo recorre la tarjeta según el ángulo
    const shift = Math.max(-33, Math.min(33, -sin * 30 + rx * 0.6));
    const band = "translate3d(" + shift.toFixed(2) + "%,0,0)";
    for (let i = 0; i < glossBands.length; i++) glossBands[i].style.transform = band;
    // el holográfico se enciende al inclinarla, como una lámina metalizada
    if (holo) {
      holoBand.style.transform = "translate3d(" + (shift * 1.4).toFixed(2) + "%,0,0)";
      const h = Math.min(1, Math.abs(sin) * 2.2 + Math.abs(rx) / 30);
      const hr = Math.round(h * 100);
      if (hr !== lastHolo) { holo.style.opacity = (h * 0.9).toFixed(2); lastHolo = hr; }
    }

    const nowBack = cos < 0;
    if (nowBack !== facingBack) {
      facingBack = nowBack;
      back.inert = !nowBack;
      front.inert = nowBack;
      updateHint();
    }
  }

  function updateHint() {
    hintText.textContent = cur > 0
      ? (games.length > 1 ? "Desliza para ver otro juego" : "Desliza para volver")
      : facingBack ? "Arrástrala o tócala para volver" : "Arrástrala o tócala para girarla";
  }

  function tick(t) {
    const dt = Math.min(0.033, (t - (lastT0 || t)) / 1000) || 0.016;
    lastT0 = t;
    if (!S.dragging) {
      // muelle amortiguado hacia el lado más cercano (anverso o reverso)
      const k = 70, c = 13;
      S.vy += (k * (S.ty - S.ry) - c * S.vy) * dt;
      S.vx += (k * (S.tx - S.rx) - c * S.vx) * dt;
      S.ry += S.vy * dt;
      S.rx += S.vx * dt;
      const settled = Math.abs(S.ty - S.ry) < 0.05 && Math.abs(S.vy) < 0.05 && Math.abs(S.rx) < 0.05 && Math.abs(S.vx) < 0.05;
      if (settled) { S.ry = S.ty; S.rx = S.tx; S.vy = S.vx = 0; }
      // balanceo suave cuando está quieta, para que se note el relieve
      if (settled && !idleSince) idleSince = t;
      if (!settled) idleSince = 0;
      const want = idleSince && t - idleSince > 600 ? 1 : 0;
      S.wob += (want - S.wob) * Math.min(1, dt * 1.5);
    } else {
      S.wob += (0 - S.wob) * Math.min(1, dt * 8);
    }
    // giroscopio suavizado
    G.x += (G.tx - G.x) * Math.min(1, dt * 7);
    G.y += (G.ty - G.y) * Math.min(1, dt * 7);
    render(t);
    // si la tarjeta del estudio no está delante, el bucle se para (ahorra batería)
    if (cur !== 0) { running = false; return; }
    requestAnimationFrame(tick);
  }

  function startMotion() {
    if (running) return;
    running = true;
    lastT0 = 0;
    requestAnimationFrame(tick);
  }

  function flip() {
    // gira media vuelta en el sentido en que ya se movía
    const dir = S.vy < 0 ? -1 : 1;
    S.ty = Math.round(S.ry / 180) * 180 + 180 * dir;
    S.tx = 0;
  }

  $("#toBack").addEventListener("click", (e) => { if (e.detail === 0) flip(); }); // teclado
  $("#toFront").addEventListener("click", () => { flip(); });

  // Arrastrar para girar (con inercia al soltar)
  let p0 = null, moved = false, lastX = 0, lastY = 0, lastT = 0;
  card.addEventListener("pointerdown", (e) => {
    if (root.classList.contains("is-intro") || e.button > 0 || cur !== 0) return;
    p0 = { x: e.clientX, y: e.clientY, ry: S.ry, rx: S.rx, target: e.target, w: card.offsetWidth };
    moved = false;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
  });
  card.addEventListener("pointermove", (e) => {
    if (!p0) return;
    const dx = e.clientX - p0.x, dy = e.clientY - p0.y;
    if (!moved && Math.hypot(dx, dy) < 7) return;
    if (!moved) {
      moved = true;
      S.dragging = true;
      card.classList.add("dragging");
      try { card.setPointerCapture(e.pointerId); } catch (err) {}
    }
    const deg = 180 / Math.max(260, p0.w * 1.1); // media vuelta ≈ un ancho de tarjeta
    S.ry = p0.ry + dx * deg;
    S.rx = Math.max(-28, Math.min(28, p0.rx - dy * deg * 0.6));
    const now = performance.now(), dtm = Math.max(1, now - lastT);
    S.vy = S.vy * 0.6 + ((e.clientX - lastX) * deg * 1000 / dtm) * 0.4;
    S.vx = S.vx * 0.6 + ((-(e.clientY - lastY)) * deg * 0.6 * 1000 / dtm) * 0.4;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  function release(e) {
    if (!p0) return;
    const start = p0;
    p0 = null;
    card.classList.remove("dragging");
    if (moved) {
      S.dragging = false;
      // se proyecta el impulso y se encaja en el lado más cercano
      const proj = S.ry + S.vy * 0.18;
      S.ty = Math.round(proj / 180) * 180;
      S.tx = 0;
      return;
    }
    // toque sin arrastrar: girar (salvo en enlaces y botones)
    if (e.type === "pointerup" && !start.target.closest("a, button:not(.hit)")) flip();
  }
  card.addEventListener("pointerup", release);
  card.addEventListener("pointercancel", release);
  // si hubo arrastre, que no se dispare el clic del enlace que quedó debajo
  card.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  card.addEventListener("dragstart", (e) => e.preventDefault());

  /* ---------- la baraja: pasar de carta ---------- */
  const slots = [...deck.querySelectorAll(".slot")];
  const last = slots.length - 1;
  const dots = $("#dots");
  dots.innerHTML = slots.map((s, i) =>
    '<button type="button" class="dot' + (i === 0 ? " dot-studio" : "") + '" aria-label="' +
    (i === 0 ? "Tarjeta de NoSkip Studio" : esc(games[i - 1].name)) + '"></button>').join("");
  const dotEls = [...dots.children];
  if (last === 0) $("#deckNav").remove();

  function layout() {
    const H = deck.offsetHeight;
    slots.forEach((s, i) => {
      const p = i - cur;
      let t = "none", o = 1, dim = 0;
      if (p < 0) { t = "translateX(-120%) rotate(-10deg)"; o = 0; }
      else if (p > 0) {
        // las siguientes cartas asoman por debajo, un poco más pequeñas y oscuras
        const k = Math.min(p, 2), sc = 1 - 0.06 * k;
        t = "translateY(" + (H * (1 - sc) / 2 + 11 * k).toFixed(1) + "px) scale(" + sc + ")";
        dim = Math.min(0.55, 0.3 * p);
        if (p > 2) o = 0;
      }
      s.style.transform = t;
      s.style.opacity = o;
      s.style.setProperty("--dim", dim);
      s.style.zIndex = 50 - Math.abs(p);
      s.inert = p !== 0;
    });
    dotEls.forEach((d, i) => d.setAttribute("aria-current", i === cur ? "true" : "false"));
    $("#prev").disabled = cur === 0;
    $("#next").disabled = cur === last;
    updateHint();
  }
  function go(i) {
    const n = Math.max(0, Math.min(last, i));
    if (n === cur) { layout(); return; }
    cur = n;
    layout();
    if (cur === 0 && !root.classList.contains("is-intro")) startMotion();
  }
  $("#prev").addEventListener("click", () => go(cur - 1));
  $("#next").addEventListener("click", () => go(cur + 1));
  dotEls.forEach((d, i) => d.addEventListener("click", () => go(i)));
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") go(cur + 1);
    if (e.key === "ArrowLeft") go(cur - 1);
  });
  addEventListener("resize", layout);

  // Deslizar las cartas de juego con el dedo (la del estudio se gira, no se desliza)
  let sw = null;
  deck.addEventListener("pointerdown", (e) => {
    if (cur === 0 || e.button > 0 || root.classList.contains("is-intro")) return;
    sw = { x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId, slot: slots[cur] };
  });
  deck.addEventListener("pointermove", (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      sw.on = true;
      sw.slot.style.transition = "none";
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    }
    sw.dx = dx;
    sw.slot.style.transform = "translateX(" + dx + "px) rotate(" + dx * 0.035 + "deg)";
  });
  function swEnd() {
    if (!sw) return;
    const s = sw;
    sw = null;
    if (!s.on) return;
    s.slot.style.transition = "";
    if (s.dx < -70) go(cur + 1);
    else if (s.dx > 70) go(cur - 1);
    else layout();
    // que el gesto no acabe pulsando un enlace
    deck.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
  }
  deck.addEventListener("pointerup", swEnd);
  deck.addEventListener("pointercancel", swEnd);

  layout();

  /* ---------- guardar contacto (vCard) ---------- */
  const btn = $("#save"), label = $("#saveText");
  btn.addEventListener("click", () => {
    const c = C.contactCard || {};
    const name = c.name || "NoSkip Studio";
    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0",
      "N:;" + name + ";;;", "FN:" + name, "ORG:" + name,
      c.email && "EMAIL;TYPE=INTERNET:" + c.email,
      c.phone && "TEL;TYPE=CELL:" + c.phone,
      c.web && "URL:" + c.web,
      c.note && "NOTE:" + c.note,
      "END:VCARD",
    ].filter(Boolean).join("\r\n");

    const url = URL.createObjectURL(new Blob([vcf], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "NoSkip-Studio.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    btn.classList.add("done");
    label.textContent = "Contacto guardado";
    setTimeout(() => { btn.classList.remove("done"); label.textContent = "Guardar contacto"; }, 2400);
  });

  /* ---------- intro: el logo se monta y la pantalla se convierte en la tarjeta ---------- */
  if (!root.classList.contains("is-intro")) { startMotion(); return; }
  if (!Element.prototype.animate) { root.classList.remove("is-intro"); startMotion(); return; }

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);

  const logo = $("#logo");
  const curtain = $("#curtain");
  const part = (n) => logo.querySelector('[data-part="' + n + '"]');
  const all = (sel) => [...logo.querySelectorAll(sel)];
  const OUT = "cubic-bezier(.16, 1, .3, 1)";
  const BACK = "cubic-bezier(.34, 1.56, .64, 1)";
  const IN_OUT = "cubic-bezier(.76, 0, .24, 1)";
  const anims = [];
  const run = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: "both" }, o)); anims.push(a); return a; };
  const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];

  const imgs = [...logo.querySelectorAll("img")];
  const ready = Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(play);

  function play() {
    try { sessionStorage.setItem("ns-intro", "1"); } catch (e) {}

    const vw = root.clientWidth, vh = root.clientHeight;

    // Para que se vea nítido, el logo se dibuja a tamaño grande y se REDUCE al final
    // (agrandar una imagen ya dibujada en pequeño es lo que la pixelaba).
    const [sx, sy] = center(logo.getBoundingClientRect());
    const smallW = logo.offsetWidth;
    const bigW = Math.min(vw * 0.84, 620);
    const K = bigW / smallW;
    logo.style.width = bigW + "px";
    logo.style.maxWidth = "none";
    const [bx, by] = center(logo.getBoundingClientRect());
    const big = "translate(" + (vw / 2 - bx) + "px," + (vh / 2 - by) + "px)";
    const home = "translate(" + (sx - bx) + "px," + (sy - by) + "px) scale(" + 1 / K + ")";
    run(logo, [{ transform: big }, { transform: big }], { duration: 1 });

    const W = logo.offsetWidth, H = logo.offsetHeight;
    // Posición de una pieza dentro del logo (las piezas son SVG: no tienen offsetLeft/Width)
    const LR = logo.getBoundingClientRect(), k = W / LR.width;
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: (b.left - LR.left) * k, y: (b.top - LR.top) * k, w: b.width * k, h: b.height * k };
    };

    // 1 · El botón de play aparece en el centro, se "pulsa" y vuela a su sitio dentro de la "o"
    //     (también dibujado grande, ×P, y reducido)
    const pl = part("play");
    const P = 3.2;
    const pb = box(pl);
    const pw = pb.w, ph = pb.h;
    const pcx = pb.x + pw / 2, pcy = pb.y + ph / 2;
    const plStyle = pl.getAttribute("style");
    Object.assign(pl.style, { left: pcx - (pw * P) / 2 + "px", top: pcy - (ph * P) / 2 + "px", width: pw * P + "px" });
    const tx = W / 2 - pcx, ty = H / 2 - pcy;
    const at = (s) => "translate(" + tx + "px," + ty + "px) scale(" + s / P + ")";
    run(pl, [
      { transform: at(0), opacity: 0, offset: 0, easing: BACK },
      { transform: at(P), opacity: 1, offset: .32, easing: "ease-in-out" },
      { transform: at(P * .8), offset: .42, easing: "ease-out" },
      { transform: at(P), offset: .5, easing: IN_OUT },
      { transform: "translate(0,0) scale(" + 1 / P + ")", opacity: 1, offset: 1 },
    ], { duration: 1250, delay: 150 });

    const d = pw * P * 2.1;
    const ring = document.createElement("span");
    ring.className = "fx-ring";
    Object.assign(ring.style, { width: d + "px", height: d + "px", left: W / 2 - d / 2 + "px", top: H / 2 - d / 2 + "px" });
    logo.appendChild(ring);
    run(ring, [
      { transform: "scale(.4)", opacity: 0, offset: 0, easing: OUT },
      { transform: "scale(1)", opacity: .9, offset: .4 },
      { transform: "scale(.88)", opacity: .9, offset: .52, easing: OUT },
      { transform: "scale(2.6)", opacity: 0, offset: 1 },
    ], { duration: 1150, delay: 150 });

    // 2 · "noskip" entra a toda velocidad, letra a letra
    const t2 = 860;
    ["w-n", "w-o", "w-s", "w-k", "w-i", "w-p"].forEach((n, i) => {
      run(part(n), [
        { transform: "translateX(" + W * 0.16 + "px) skewX(-14deg)", opacity: 0, filter: "blur(6px)" },
        { transform: "none", opacity: 1, filter: "blur(0)" },
      ], { duration: 720, delay: t2 + i * 55, easing: OUT });
    });

    // 3 · Las líneas se abren y "STUDIO" sube
    const t3 = 1380;
    [["line-l", "100% 50%"], ["line-r", "0% 50%"]].forEach(([n, o]) => {
      run(part(n), [
        { transform: "scaleX(0)", transformOrigin: o, opacity: 1 },
        { transform: "scaleX(1)", transformOrigin: o, opacity: 1 },
      ], { duration: 700, delay: t3, easing: OUT });
    });
    all(".studio").forEach((el, i) => {
      run(el, [{ transform: "translateY(70%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, delay: t3 + 60 + i * 40, easing: OUT });
    });

    // 4 · La estrella cae como el punto de la "i", con destello
    const t4 = 1640;
    const st = part("star");
    run(st, [
      { transform: "scale(0) rotate(-140deg)", opacity: 0, offset: 0, easing: OUT },
      { transform: "scale(1.35) rotate(12deg)", opacity: 1, offset: .55, easing: "ease-in-out" },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 1 },
    ], { duration: 720, delay: t4 });
    const sb = box(st);
    const f = sb.w * 2.4;
    const flash = document.createElement("span");
    flash.className = "fx-flash";
    Object.assign(flash.style, {
      width: f + "px", height: f + "px",
      left: sb.x + sb.w / 2 - f / 2 + "px",
      top: sb.y + sb.h / 2 - f / 2 + "px",
    });
    logo.insertBefore(flash, st);
    run(flash, [
      { transform: "scale(.2)", opacity: 0 },
      { transform: "scale(1)", opacity: 1, offset: .3 },
      { transform: "scale(1.8)", opacity: 0 },
    ], { duration: 800, delay: t4 + 200, easing: "ease-out" });

    // 5 · La pantalla negra se encoge hasta ser la tarjeta y el logo se coloca en ella
    const t5 = 2550;
    run(logo, [{ transform: big }, { transform: home }], { duration: 1050, delay: t5, easing: IN_OUT });

    const rest = [$(".front-foot"), $("#shadow"), $("#deckNav"), $("#hint"), $("#save"), $("#marks")].filter(Boolean);
    rest.forEach((el, i) =>
      run(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
        { duration: 700, delay: t5 + 900 + i * 90, easing: OUT })
    );

    // La forma de la tarjeta se mide justo en ese momento (por si la ventana ha cambiado)
    const start = performance.now();
    setTimeout(() => {
      const late = Math.max(0, performance.now() - start - t5);
      const c = card.getBoundingClientRect();
      const R = parseFloat(getComputedStyle(front).borderTopLeftRadius) || 20;
      const box = "inset(" + c.top + "px " + (root.clientWidth - c.right) + "px " + (root.clientHeight - c.bottom) + "px " + c.left + "px round " + R + "px)";
      const shrink = run(curtain, [{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: box }], { duration: 1050, easing: IN_OUT });
      shrink.currentTime = Math.min(late, 1000);

      // Cuando la cortina ya tiene la forma de la tarjeta, la tarjeta real ocupa su lugar
      shrink.finished.then(() => {
        root.classList.remove("is-intro");
        curtain.remove();
        ring.remove();
        flash.remove();
        return Promise.all(anims.map((a) => a.finished));
      }).then(cleanup);
      setTimeout(cleanup, 2600); // por si acaso
    }, t5);

    // Se vuelve al logo normal en el mismo fotograma: no hay ningún salto visible
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      root.classList.remove("is-intro");
      curtain.remove();
      logo.style.width = "";
      logo.style.maxWidth = "";
      pl.setAttribute("style", plStyle);
      anims.forEach((a) => a.cancel());
      ring.remove();
      flash.remove();
      startMotion();
    }
  }
})();
