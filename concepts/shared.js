// Общий скрипт двух концептов FRAMEX: заставка, появление блоков, меню, демо-форма, лента работ.
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Знак X ↔ рама.
   «sketch» (по эскизу клиентки, по умолчанию в A): X из четырёх объёмных профилей. X разбирается, профили
   по очереди (левый верхний, правый верхний, левый нижний, правый нижний) переворачиваются вокруг вертикальной
   оси — половина X «>» становится углом рамы «<»; рама-ромб с отверстиями собирается, разворачивается
   в перспективе и тем же путём возвращается в X. Без библиотек: проекция в SVG, кадр зависит только от времени,
   поэтому анимация и проигрывается, и прокручивается.
   «square» (?logo=1, концепт B): плоский X, рама-квадрат с отверстиями (SVG). */
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const X_ENDS = [[8, 8], [92, 8], [92, 92], [8, 92]];
const SQUARE = [[8, 8], [92, 8], [92, 92], [8, 92]];
const HOLES = [0.24, 0.5, 0.76];
const SVG_NS = "http://www.w3.org/2000/svg";
const logoParam = new URLSearchParams(location.search).get("logo");
const pageLogo = logoParam === "1" ? "square" : logoParam === "2" ? "sketch" : root.dataset.logo || "square";

/* --- Плоский вариант (SVG) --- */
function setupMark(svg) {
  if (svg.markBars) return;
  svg.textContent = "";
  svg.markBars = X_ENDS.map(() => {
    const g = document.createElementNS(SVG_NS, "g");
    const bar = document.createElementNS(SVG_NS, "line");
    bar.setAttribute("class", "mark-bar");
    const holes = HOLES.map(() => {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("class", "mark-hole");
      c.setAttribute("r", "3.3");
      return c;
    });
    g.append(bar, ...holes);
    svg.append(g);
    return { bar, holes };
  });
}

function drawMark(svg, t) {
  setupMark(svg);
  const holeOpacity = Math.min(Math.max((t - 0.72) / 0.28, 0), 1).toFixed(3);
  svg.markBars.forEach(({ bar, holes }, i) => {
    const a = SQUARE[i];
    const b = SQUARE[(i + 1) % 4];
    const x1 = mix(50, a[0], t), y1 = mix(50, a[1], t);
    const x2 = mix(X_ENDS[i][0], b[0], t), y2 = mix(X_ENDS[i][1], b[1], t);
    bar.setAttribute("x1", x1.toFixed(2));
    bar.setAttribute("y1", y1.toFixed(2));
    bar.setAttribute("x2", x2.toFixed(2));
    bar.setAttribute("y2", y2.toFixed(2));
    holes.forEach((hole, k) => {
      hole.setAttribute("cx", mix(x1, x2, HOLES[k]).toFixed(2));
      hole.setAttribute("cy", mix(y1, y2, HOLES[k]).toFixed(2));
      hole.setAttribute("opacity", holeOpacity);
    });
  });
}

function tween(svg, from, to, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      drawMark(svg, mix(from, to, ease(t)));
      t < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  });
}

function svgController(svg) {
  drawMark(svg, 0);
  return {
    frameAt: 0.5,
    // p: 0 — X, 0.5 — рама, 1 — снова X
    seek: (p) => drawMark(svg, p <= 0.5 ? ease(p * 2) : ease((1 - p) * 2)),
    async play() {
      await tween(svg, 0, 1, 560);
      await sleep(520);
      await tween(svg, 1, 0, 460);
    },
  };
}

/* --- Объёмный вариант по эскизу: маленький 3D-рендер в SVG ---
   Четыре настоящих профиля рамы (ширина, глубина, торцы «на ус»). На каждом кадре вершины
   поворачиваются и проецируются, невидимые грани отбрасываются, ближние профили рисуются поверх дальних.
   Получается чистый вектор без «бумажных» рёбер, одинаковый во всех браузерах.
   Отверстия — на наружном ребре профиля, как на эскизе и у настоящих рам: рама разворачивается так, что видны
   верхнее и правое рёбра с отверстиями (рисунок 3 верхнего листка). */
const SKETCH_T = 2200; // полный цикл X → рама → X, мс
const PR = { w: 15, d: 12, rx: 50, ry: 48, ex: 16, ef: 7, fit: 0.94 }; // ширина и глубина профиля, полуоси ромба, разлёт X и рамы, масштаб рамы
const RH = Math.hypot(PR.rx, PR.ry);
const RX_IN = PR.rx - (PR.w * RH) / PR.ry; // внутренний ромб: толщина по горизонтали w/sinθ
const RY_IN = PR.ry - (PR.w * RH) / PR.rx; // и по вертикали w/cosθ
const SHIFT = (PR.rx - RX_IN) / 2; // сдвиг половинок, чтобы перевёрнутые «>» и «<» сложились в X
// Профили в порядке эскиза: левый верхний, правый верхний, левый нижний, правый нижний.
// Внешняя и внутренняя вершины ромба на каждом торце: торцы горизонтальные слева/справа, вертикальные сверху/снизу.
const RHOMB = (rx, ry) => ({ L: [50 - rx, 50], T: [50, 50 - ry], R: [50 + rx, 50], B: [50, 50 + ry] });
const OUT = RHOMB(PR.rx, PR.ry);
const IN = RHOMB(RX_IN, RY_IN);
const PROFILES = [["L", "T"], ["T", "R"], ["L", "B"], ["B", "R"]].map(([a, b], i) => ({
  quad: [OUT[a], OUT[b], IN[b], IN[a]],
  ends: [[OUT[a], IN[a]], [OUT[b], IN[b]]],
  side: i % 2 ? -1 : 1, // левые профили (составляют «>») и правые («<»)
}));
const VIEW = { ax: 56, ay: -10, az: 0 }; // ракурс рамы: ложится, раскрываясь снизу (по просьбе клиентки, как было раньше)
const easeIO = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// значение на отрезке времени [a, b]: от 0 до 1 с плавным разгоном и торможением
const span = (ms, a, b) => easeIO((ms - a) / (b - a));

// Раскадровка (мс): 0–200 X разбирается и замирает; 260–910 профили по очереди переворачиваются в раму;
// 880–1080 рама собирается; 900–1200 разворачивается рёбрами с отверстиями к зрителю; 1400 обратно: разбор, переворот, X.
function sketchPose(ms) {
  const flipIn = (i) => span(ms, 260 + i * 70, 700 + i * 70);
  const flipOut = (i) => span(ms, 1520 + i * 70, 1900 + i * 70);
  const ex = span(ms, 0, 200) - span(ms, 880, 1080) + span(ms, 1400, 1580) - span(ms, 2000, 2200);
  const tilt = span(ms, 900, 1200) - span(ms, 1400, 1640);
  return { ex, tilt, arms: PROFILES.map((_, i) => flipIn(i) - flipOut(i)) }; // 0 — X, 1 — рама
}

function sketchController(svg) {
  svg.textContent = "";
  svg.style.overflow = "visible";
  // отверстия по наружному ребру: центры на середине толщины, окружность в плоскости ребра
  const holes = (p) => {
    const [a, b] = p.quad;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return [0.25, 0.5, 0.75].map((f) => ({ c: [mix(a[0], b[0], f), mix(a[1], b[1], f)], u }));
  };
  const parts = PROFILES.map((p) => {
    const g = document.createElementNS(SVG_NS, "g");
    const faces = Array.from({ length: 6 }, () => g.appendChild(document.createElementNS(SVG_NS, "path")));
    const holePath = g.appendChild(document.createElementNS(SVG_NS, "path"));
    holePath.setAttribute("style", "fill:var(--hole, #fff);stroke:none");
    svg.append(g);
    const xs = p.quad.map((v) => v[0]);
    return { ...p, g, faces, holePath, cx: (Math.min(...xs) + Math.max(...xs)) / 2, holes: holes(p) };
  });
  const H = PR.d / 2;

  function render(ms) {
    const { ex, tilt, arms } = sketchPose(ms);
    const fit = (1 - (1 - PR.fit) * (arms.reduce((s, m) => s + m, 0) / 4)) * (1 + 0.15 * tilt); // лежащая рама ниже — чуть крупнее
    const ay = (VIEW.ay * tilt * Math.PI) / 180, ax = (VIEW.ax * tilt * Math.PI) / 180;
    const az = (VIEW.az * tilt * Math.PI) / 180;
    const [cy, sy, cxr, sxr, cz, sz] = [Math.cos(ay), Math.sin(ay), Math.cos(ax), Math.sin(ax), Math.cos(az), Math.sin(az)];
    const drawn = parts.map((p, i) => {
      const m = arms[i];
      const phi = Math.PI * (1 + m); // 180° — X, 360° — рама
      const [c, s] = [Math.cos(phi), Math.sin(phi)];
      // разлёт: от центра знака наружу, в X — вдоль диагонали, в раме — поперёк стороны
      const dx = (1 - m) * p.side * SHIFT;
      const mid = p.quad.reduce((a, v) => [a[0] + v[0] / 4, a[1] + v[1] / 4], [0, 0]);
      const up = Math.sign(mid[1] - 50);
      const fx = mid[0] - 50, fy = mid[1] - 50, fl = Math.hypot(fx, fy);
      const dirX = mix(-p.side * Math.SQRT1_2, fx / fl, m), dirY = mix(up * Math.SQRT1_2, fy / fl, m), len = Math.hypot(dirX, dirY) || 1;
      const e = ex * mix(PR.ex, PR.ef, m);
      const tx = dx + (e * dirX) / len, ty = (e * dirY) / len;
      const P = ([x, y, z]) => {
        // поворот профиля вокруг своей вертикальной оси, разлёт, масштаб рамы
        let X = p.cx + (x - p.cx) * c + z * s + tx, Y = y + ty, Z = -(x - p.cx) * s + z * c;
        X = 50 + (X - 50) * fit; Y = 50 + (Y - 50) * fit; Z *= fit;
        [X, Y] = [50 + (X - 50) * cz - (Y - 50) * sz, 50 + (X - 50) * sz + (Y - 50) * cz];
        // разворот всего знака в перспективе (вокруг Y, потом X), проекция ортогональная
        const X1 = 50 + (X - 50) * cy + Z * sy, Z1 = -(X - 50) * sy + Z * cy;
        return [X1, 50 + (Y - 50) * cxr - Z1 * sxr, (Y - 50) * sxr + Z1 * cxr];
      };
      const top = p.quad.map(([x, y]) => P([x, y, H]));
      const bot = p.quad.map(([x, y]) => P([x, y, -H]));
      const centre = [...top, ...bot].reduce((a, v) => a.map((k, j) => k + v[j] / 8), [0, 0, 0]);
      const polys = [top, [...bot].reverse(), ...[0, 1, 2, 3].map((k) => [top[k], bot[k], bot[(k + 1) % 4], top[(k + 1) % 4]])];
      polys.forEach((poly, f) => {
        const el = p.faces[f];
        // нормаль грани, направленная наружу; грань видна, если смотрит на зрителя (+Z)
        const [a, b, q] = [poly[0], poly[1], poly[2]];
        let n = [(b[1] - a[1]) * (q[2] - a[2]) - (b[2] - a[2]) * (q[1] - a[1]), (b[2] - a[2]) * (q[0] - a[0]) - (b[0] - a[0]) * (q[2] - a[2]), (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])];
        const fc = poly.reduce((acc, v) => acc.map((k, j) => k + v[j] / poly.length), [0, 0, 0]);
        const nl = Math.hypot(...n) || 1;
        n = n.map((k) => k / nl);
        if (n[0] * (fc[0] - centre[0]) + n[1] * (fc[1] - centre[1]) + n[2] * (fc[2] - centre[2]) < 0) n = n.map((k) => -k);
        if (f === 2) p.holePath.setAttribute("d", "");
        if (n[2] < 0.02) return el.setAttribute("d", "");
        const d = `M${poly.map((v) => `${v[0].toFixed(2)} ${v[1].toFixed(2)}`).join("L")}Z`;
        if (f === 2) {
          // наружное ребро: отверстия цветом фона (--hole) поверх грани; сквозь сплошной профиль ничего не видно
          p.holePath.setAttribute("d", p.holes.map(({ c: [hx, hy], u }) => `M${Array.from({ length: 20 }, (_, k) => {
            const t = (k / 20) * 2 * Math.PI, r = PR.d * 0.27;
            const v = P([hx + r * Math.cos(t) * u[0], hy + r * Math.cos(t) * u[1], r * Math.sin(t)]);
            return `${v[0].toFixed(2)} ${v[1].toFixed(2)}`;
          }).join("L")}Z`).join(""));
        }
        // светотень: свет спереди-слева-сверху. Грань к зрителю — чистый цвет знака, рёбра справа и снизу темнее.
        // Тень смешивается с --mark-shade (тон фона), а не с чёрным: белый знак не даёт серых полос.
        const dark = Math.min(Math.max((0.55 * (0.85 - (-0.4 * n[0] - 0.3 * n[1] + 0.85 * n[2]))) / 0.85, 0), 0.7);
        const fill = dark < 0.005 ? "currentColor" : `color-mix(in srgb, currentColor ${(100 - dark * 100).toFixed(1)}%, var(--mark-shade, #000))`;
        el.setAttribute("d", d);
        // обводка тем же цветом закрывает волосяные просветы на стыках граней
        el.setAttribute("style", `fill:${fill};stroke:${fill};stroke-width:0.35;stroke-linejoin:round`);
      });
      return { g: p.g, z: centre[2] };
    });
    drawn.sort((a, b) => a.z - b.z).forEach(({ g }) => svg.append(g)); // дальние раньше, ближние поверх
  }

  render(0);
  let raf = 0;
  return {
    frameAt: 1240 / SKETCH_T, // рама собрана и развёрнута
    seek(p) {
      cancelAnimationFrame(raf);
      render(Math.min(Math.max(p, 0), 1) * SKETCH_T);
    },
    play() {
      cancelAnimationFrame(raf);
      return new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          const ms = Math.min(now - start, SKETCH_T);
          render(ms);
          ms < SKETCH_T ? (raf = requestAnimationFrame(step)) : resolve();
        };
        raf = requestAnimationFrame(step);
      });
    },
  };
}

// Знаки, которые двигаются: заставка, первый экран, лента бренда, витрина на странице выбора
document.querySelectorAll("[data-mark], [data-scroll-mark], [data-hero-mark], [data-mark-demo] svg").forEach((svg) => {
  const variant = svg.dataset.variant || pageLogo;
  svg.mark = variant === "sketch" ? sketchController(svg) : svgController(svg);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wait = (ms) => sleep(skipped ? 0 : ms);

// Подпись «печатается» по буквам; isCancelled позволяет мгновенно дописать её при пропуске заставки.
function typeText(el, delay, isCancelled = () => false) {
  const text = el.dataset.type || "";
  el.textContent = "";
  el.classList.add("is-typing");
  return [...text]
    .reduce(
      (chain, char) =>
        chain
          .then(() => (isCancelled() ? null : sleep(delay)))
          .then(() => {
            if (!isCancelled()) el.textContent += char;
          }),
      Promise.resolve()
    )
    .then(() => {
      el.textContent = text;
      el.classList.remove("is-typing");
    });
}

/* Заставка */
const intro = document.querySelector("[data-intro]");
const pageParts = document.querySelectorAll("body > .skip-link, body > header, body > main, body > footer");
let skipped = false;

function finishIntro() {
  if (!intro || !root.classList.contains("intro-on")) return afterIntro();
  skipped = true;
  try {
    sessionStorage.setItem("framex-intro-seen", "1");
  } catch {}
  // Вариант B: синее окно раскрывается из места, где стоит X, на весь экран
  const cover = intro.querySelector("[data-intro-cover]");
  const mark = intro.querySelector("[data-mark]");
  if (cover && mark && !reduceMotion) {
    const r = mark.getBoundingClientRect();
    cover.style.transition = "none";
    cover.style.clipPath = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;
    cover.getBoundingClientRect();
    cover.style.transition = "";
    cover.style.clipPath = "inset(0)";
  }
  intro.classList.add("is-leaving");
  pageParts.forEach((el) => (el.inert = false));
  const done = () => {
    root.classList.remove("intro-on");
    intro.remove();
    afterIntro();
  };
  reduceMotion ? done() : setTimeout(done, +intro.dataset.introExit || 600);
}

async function playIntro() {
  // Страховка: в скрытой вкладке кадры анимации не идут, а заставка не должна держать страницу.
  if (document.hidden) return finishIntro();
  setTimeout(finishIntro, 6000);
  document.addEventListener("visibilitychange", () => document.hidden && finishIntro());
  pageParts.forEach((el) => (el.inert = true));
  const skip = intro.querySelector("[data-intro-skip]");
  skip?.addEventListener("click", finishIntro);
  document.addEventListener("keydown", (e) => e.key === "Escape" && finishIntro(), { once: true });
  skip?.focus({ preventScroll: true });

  const mark = intro.querySelector("[data-mark]");
  intro.classList.add("is-playing");
  await wait(+intro.dataset.introDelay || 700); // буквы F-R-A-M-E появляются по очереди (CSS)
  if (!skipped) await mark.mark.play(); // X → рама с отверстиями → X
  const sign = intro.querySelector("[data-type]");
  if (sign) await typeText(sign, 55, () => skipped);
  await wait(sign ? 380 : 200);
  if (!skipped) finishIntro();
}

let introFinished = false;
function afterIntro() {
  if (introFinished) return;
  introFinished = true;
  root.classList.add("page-ready");
  startReveal();
  if (reduceMotion) return;
  document.querySelectorAll("[data-type-after-intro]").forEach((el) => {
    el.textContent = "";
    setTimeout(() => typeText(el, 90), 450);
  });
}


/* Текст «печатается»: заголовки появляются по словам, слоганы и манифест — по буквам.
   Разбиение делаем только когда движение разрешено; экранным дикторам остаётся целый текст. */
function wrapText(el, unit) {
  let i = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    const parts = unit === "word" ? node.textContent.split(/([ \n\t]+)/) : [...node.textContent];
    parts.forEach((part) => {
      if (!part.trim()) return frag.append(part);
      const outer = document.createElement("span");
      outer.className = unit === "word" ? "w" : "c";
      if (unit === "word") {
        const inner = document.createElement("span");
        inner.textContent = part;
        outer.append(inner);
      } else outer.textContent = part;
      outer.style.setProperty("--i", i++);
      frag.append(outer);
    });
    node.replaceWith(frag);
  });
}

function splitForMotion(el, unit) {
  const label = document.createElement("span");
  label.className = "vh";
  label.textContent = el.textContent.replace(/\s+/g, " ").trim();
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  visual.className = "split";
  visual.append(...el.childNodes);
  el.append(label, visual);
  wrapText(visual, unit);
}

if (!reduceMotion) {
  document.querySelectorAll("[data-split]").forEach((el) => splitForMotion(el, "word"));
  document.querySelectorAll("[data-print]").forEach((el) => splitForMotion(el, "char"));
}

/* Появление при прокрутке — только после заставки, чтобы анимации не проиграли под ней */
const revealItems = document.querySelectorAll("[data-reveal], [data-split], [data-print]");
function startReveal() {
  if (reduceMotion || !("IntersectionObserver" in window)) return revealItems.forEach((el) => el.classList.add("is-in"));
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }),
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
  );
  revealItems.forEach((el) => observer.observe(el));
}

/* Шапка: тень после начала прокрутки, прячется при прокрутке вниз и возвращается при прокрутке вверх */
const header = document.querySelector(".header");
let lastY = scrollY;
let travel = 0; // накопленный путь в одном направлении: мелкие колебания не прячут и не показывают шапку
let ticking = false;
const parallax = document.querySelectorAll("[data-parallax]");
const frameHero = document.querySelector("[data-frame-hero]");
const expands = document.querySelectorAll("[data-expand]");
const marquees = [...document.querySelectorAll("[data-marquee]")].map((el) => ({ el, mark: el.querySelector("[data-scroll-mark]") }));
const heroMark = document.querySelector("[data-hero-mark]");
const depth = document.querySelectorAll("[data-speed]");
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

function onScroll() {
  ticking = false;
  const y = scrollY;
  if (header && !root.classList.contains("menu-open")) {
    header.classList.toggle("is-scrolled", y > 8);
    const dy = y - lastY;
    if (dy && Math.sign(dy) !== Math.sign(travel)) travel = 0;
    travel += dy;
    const pinned = y < header.offsetHeight * 2 || header.contains(document.activeElement);
    if (pinned || travel < -12) header.classList.remove("is-hidden");
    else if (travel > 24) header.classList.add("is-hidden");
  }
  lastY = y;
  if (reduceMotion) return;
  parallax.forEach((el) => {
    if (y < innerHeight * 1.3) el.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0) scale(1.08)`;
  });
  const vh = innerHeight;
  // Переход «рамой»: тёмный блок въезжает узкой панелью и раскрывается на всю ширину
  expands.forEach((el) => {
    const top = el.getBoundingClientRect().top;
    el.style.setProperty("--e", ease(clamp01((vh - top) / (vh * 0.75))).toFixed(4));
  });
  // Лента бренда едет вбок, X в ней превращается в раму и обратно
  marquees.forEach(({ el, mark }) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const q = clamp01((vh - r.top) / (vh + r.height));
    el.style.setProperty("--q", q.toFixed(4));
    mark?.mark?.seek(q);
  });
  // Глубина: фото внутри рамок смещаются медленнее страницы
  depth.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    const shift = ((r.top + r.height / 2 - vh / 2) * -(+img.dataset.speed || 0.08)).toFixed(1);
    img.style.translate = `0 ${shift}px`;
  });
  heroMark?.mark?.seek(clamp01(y / (vh * 0.55)) * heroMark.mark.frameAt);
  if (frameHero) {
    const r = frameHero.getBoundingClientRect();
    const range = r.height - innerHeight;
    const p = range > 0 ? Math.min(Math.max(-r.top / range, 0), 1) : 0;
    frameHero.style.setProperty("--p", ease(p).toFixed(4));
    frameHero.classList.toggle("is-open", p > 0.92);
  }
}
addEventListener(
  "scroll",
  () => {
    if (!ticking) requestAnimationFrame(onScroll);
    ticking = true;
  },
  { passive: true }
);
addEventListener("resize", onScroll);
header?.addEventListener("focusin", () => header.classList.remove("is-hidden"));
if (frameHero && !reduceMotion) frameHero.classList.add("is-scrubbed");
onScroll();

/* Вопросы раскрываются плавно */
document.querySelectorAll("details").forEach((item) => {
  const summary = item.querySelector("summary");
  const body = summary.nextElementSibling;
  summary.addEventListener("click", (e) => {
    if (reduceMotion || !body?.animate) return;
    e.preventDefault();
    const timing = { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
    if (item.open) {
      item.classList.remove("is-open");
      body.animate([{ height: `${body.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], timing).onfinish = () => (item.open = false);
    } else {
      item.open = true;
      item.classList.add("is-open");
      body.animate([{ height: "0px", opacity: 0 }, { height: `${body.offsetHeight}px`, opacity: 1 }], timing);
    }
  });
});

/* Мобильное меню.
   Открыто: остальная страница недоступна (inert) и не прокручивается, фокус остаётся в шапке.
   Закрытие: Escape, кнопка, пункт меню или переход на широкий экран; фокус возвращается на кнопку.
   С data-animated (концепт A) панель закрывается анимацией, без него — сразу (концепт B). */
const menuButton = document.querySelector("[data-menu-toggle]");
const menu = document.getElementById(menuButton?.getAttribute("aria-controls"));
let menuScrollY = 0;
let menuTimer = 0;
const menuOutside = () => [...document.querySelectorAll("body > *")].filter((el) => el !== header && el.tagName !== "SCRIPT" && el.tagName !== "DIALOG");
function setMenu(open, { restoreFocus = false } = {}) {
  if (!menuButton || !menu) return;
  if (open === root.classList.contains("menu-open")) return;
  clearTimeout(menuTimer);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  root.classList.toggle("menu-open", open);
  menuOutside().forEach((el) => (el.inert = open));
  const body = document.body;
  if (open) {
    menuScrollY = scrollY;
    header?.classList.remove("is-hidden");
    // фиксируем страницу на месте, чтобы фон не прокручивался и на iOS
    Object.assign(body.style, { position: "fixed", top: `-${menuScrollY}px`, left: "0", right: "0" });
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
  } else {
    Object.assign(body.style, { position: "", top: "", left: "", right: "" });
    scrollTo({ top: menuScrollY, behavior: "instant" });
    menu.classList.remove("is-open");
    const hide = () => (menu.hidden = true);
    if (menu.hasAttribute("data-animated") && !reduceMotion) menuTimer = setTimeout(hide, 450);
    else hide();
    if (restoreFocus) menuButton.focus();
  }
}
if (menuButton && menu) {
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  // Пункт меню: закрываем и даём ссылке перейти (якорь или другая страница)
  menu.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("menu-open")) setMenu(false, { restoreFocus: true });
  });
  matchMedia("(min-width: 961px)").addEventListener("change", (e) => e.matches && setMenu(false));
}

/* Подсветка текущего раздела в навигации главной */
const spyLinks = [...document.querySelectorAll(".nav a[data-spy]")];
if (spyLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(spyLinks.map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach((a) => a.removeAttribute("aria-current"));
        byId.get(entry.target.id)?.setAttribute("aria-current", "true");
      }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  });
  // над первым разделом подсветки нет
  addEventListener("scroll", () => scrollY < innerHeight * 0.5 && spyLinks.forEach((a) => a.removeAttribute("aria-current")), { passive: true });
}

/* Лента работ (концепт B) */
document.querySelectorAll("[data-strip]").forEach((wrap) => {
  const track = wrap.querySelector("[data-strip-track]");
  const by = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  wrap.querySelector("[data-strip-prev]")?.addEventListener("click", () => by(-1));
  wrap.querySelector("[data-strip-next]")?.addEventListener("click", () => by(1));
});

/* Просмотр фото проекта на весь экран: стрелки, клавиатура, Esc (нативный dialog) */
const viewer = document.querySelector("[data-viewer]");
if (viewer?.showModal) {
  const img = document.createElement("img");
  viewer.prepend(img);
  const caption = viewer.querySelector("[data-viewer-caption]");
  let group = [];
  let index = 0;
  const show = (i) => {
    index = (i + group.length) % group.length;
    const link = group[index];
    img.src = link.href;
    img.alt = link.querySelector("img").alt;
    caption.textContent = `${link.dataset.project} · ${index + 1} из ${group.length}`;
  };
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-photo]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    group = [...document.querySelectorAll(`[data-photo][data-project="${CSS.escape(link.dataset.project)}"]`)];
    show(group.indexOf(link));
    viewer.showModal();
  });
  viewer.querySelector("[data-viewer-prev]").addEventListener("click", () => show(index - 1));
  viewer.querySelector("[data-viewer-next]").addEventListener("click", () => show(index + 1));
  viewer.querySelector("[data-viewer-close]").addEventListener("click", () => viewer.close());
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
  viewer.addEventListener("click", (e) => e.target === viewer && viewer.close());
}

/* Знаки на странице выбора: X → рама → X сразу и по кнопке «Повторить» */
document.querySelectorAll("[data-mark-demo]").forEach((card) => {
  const mark = card.querySelector(".mark").mark;
  const play = () => (reduceMotion ? mark.seek(mark.frameAt) : mark.play());
  card.querySelector("button")?.addEventListener("click", play);
  setTimeout(play, 700);
});

/* Вложения в демо-форме: файлы можно добавлять несколькими заходами и убирать по одному.
   Набор файлов в поле меняется на самом деле (DataTransfer); без его поддержки кнопки «убрать» не показываем. */
const canEditFiles = (() => {
  try {
    return !!new DataTransfer().items;
  } catch {
    return false;
  }
})();
const fileSize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} КБ` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
document.querySelectorAll("[data-file-input]").forEach((input) => {
  const list = input.parentElement.querySelector("[data-file-list]");
  const itemTag = list?.tagName === "UL" ? "li" : "span";
  let picked = [];
  const render = () => {
    if (canEditFiles) {
      const dt = new DataTransfer();
      picked.forEach((f) => dt.items.add(f));
      input.files = dt.files;
    }
    if (!list) return;
    if (itemTag === "span") return (list.textContent = picked.map((f) => f.name).join(", "));
    list.replaceChildren(
      ...picked.map((f, i) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = f.name;
        name.title = f.name;
        const size = document.createElement("span");
        size.className = "file-size";
        size.textContent = fileSize(f.size);
        li.append(name, size);
        if (canEditFiles) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "file-remove";
          remove.dataset.remove = i;
          remove.setAttribute("aria-label", `Убрать файл ${f.name}`);
          remove.textContent = "×";
          li.append(remove);
        }
        return li;
      })
    );
  };
  input.addEventListener("change", () => {
    const fresh = [...input.files];
    picked = canEditFiles ? [...picked, ...fresh.filter((f) => !picked.some((p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified))] : fresh;
    render();
  });
  list?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    picked.splice(+btn.dataset.remove, 1);
    render();
    (list.querySelector(".file-remove") || input.parentElement.querySelector("label"))?.focus();
  });
});

/* Демо-форма: понятные ошибки полей; отправки нет, и форма честно об этом говорит */
const formChecks = {
  name: (el) => (el.value.trim() ? "" : "Укажите, как к вам обращаться"),
  phone: (el) => ((el.value.match(/\d/g) || []).length >= 10 ? "" : "Укажите телефон: не меньше 10 цифр"),
  email: (el) => (!el.value.trim() || el.checkValidity() ? "" : "Проверьте адрес почты: например, name@company.ru"),
  consent: (el) => (el.checked ? "" : "Нужно согласие на обработку данных"),
};
document.querySelectorAll("[data-demo-form]").forEach((form) => {
  const status = form.querySelector("[data-form-status]");
  const check = (el) => {
    const msg = formChecks[el.name]?.(el) ?? "";
    const out = form.querySelector(`[data-error-for="${el.name}"]`);
    if (out) out.textContent = msg;
    if (msg) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
    return !msg;
  };
  form.addEventListener("input", (e) => e.target.getAttribute("aria-invalid") === "true" && check(e.target));
  form.addEventListener("change", (e) => e.target.type === "checkbox" && e.target.getAttribute("aria-invalid") === "true" && check(e.target));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.noValidate) {
      const fields = Object.keys(formChecks).map((n) => form.elements[n]).filter(Boolean);
      const bad = fields.filter((el) => !check(el));
      if (bad.length) {
        status.textContent = "";
        return bad[0].focus();
      }
    }
    status.textContent = "Демо-режим: заявка не отправлена. Отправку подключим после согласования адресов и серверной части.";
  });
});

/* Страница 3D-стенда: вращение модели, рендер и каркас, загрузка, ошибка и откат на рендер */
const stand = document.querySelector("[data-stand]");
if (stand) {
  const model = stand.querySelector("[data-model]");
  const still = stand.querySelector("[data-still]");
  const status = stand.querySelector("[data-stand-status]");
  const hint = stand.querySelector("[data-stand-hint]");
  const auto = stand.querySelector("[data-autorotate]");
  const bar = stand.querySelector(".stand-progress");
  const base = model.getAttribute("poster").replace(/[^/]+$/, "");
  const views = {
    hero: { src: `${base}render_hero.webp`, alt: "Рендер демонстрационного стенда FRAMEX", hint: "Статичный рендер стенда." },
    frame: { src: `${base}render_frame.webp`, alt: "Каркас демонстрационного стенда FRAMEX без обшивки, печати и мебели", hint: "Каркас того же стенда без обшивки и мебели." },
  };
  const hint3d = hint.textContent;
  const buttons = stand.querySelectorAll("[data-mode]");
  let failed = false;
  const setMode = (mode) => {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const is3d = mode === "3d";
    model.hidden = !is3d;
    still.hidden = is3d;
    auto.closest("label").hidden = !is3d;
    if (!is3d) {
      still.src = views[mode].src;
      still.alt = views[mode].alt;
    }
    hint.textContent = is3d ? hint3d : views[mode].hint;
  };
  const fail = (text) => {
    if (failed) return;
    failed = true;
    status.hidden = false;
    status.textContent = text;
    stand.querySelector('[data-mode="3d"]').disabled = true;
    setMode("hero");
  };
  buttons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  auto.checked = false; // автовращение по умолчанию выключено
  auto.addEventListener("change", () => model.toggleAttribute("auto-rotate", auto.checked));
  model.addEventListener("progress", (e) => {
    const p = e.detail?.totalProgress ?? 0;
    bar?.style.setProperty("--progress", `${Math.round(p * 100)}%`);
    if (p >= 1) bar?.classList.add("is-done");
  });
  model.addEventListener("load", () => {
    status.hidden = true;
    bar?.classList.add("is-done");
  });
  model.addEventListener("error", () => fail("3D-модель не загрузилась — показываем рендер."));
  const gl = document.createElement("canvas");
  if (!(gl.getContext("webgl2") || gl.getContext("webgl"))) fail("Браузер не поддерживает 3D — показываем рендер.");
  // если библиотека просмотра не подключилась, через 10 с остаёмся на рендере
  setTimeout(() => !customElements.get("model-viewer") && fail("3D-просмотр недоступен — показываем рендер."), 10000);
}

// Запуск в конце файла: к этому моменту все функции и списки элементов уже объявлены.
if (intro && root.classList.contains("intro-on")) playIntro();
else {
  intro?.remove();
  afterIntro();
}

// Работы: у проекта несколько фото, миниатюры переключают главное
document.querySelectorAll("[data-work]").forEach((work) => {
  const main = work.querySelector("[data-work-main]");
  const thumbs = work.querySelectorAll(".work-thumb");
  thumbs.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-pressed") === "true") return;
      thumbs.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      main.classList.add("is-swapping");
      setTimeout(() => {
        main.src = btn.dataset.src;
        main.alt = btn.dataset.alt;
        main.classList.remove("is-swapping");
      }, reduceMotion ? 0 : 250);
    })
  );
});
