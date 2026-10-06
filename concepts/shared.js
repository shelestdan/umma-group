// Общий скрипт двух концептов FRAMEX: заставка, появление блоков, меню, демо-форма, лента работ.
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Знак X ↔ рама.
   «sketch» (по эскизу клиентки, по умолчанию в A): X из четырёх профилей с гранью-толщиной. Каждый профиль
   переворачивается вокруг вертикальной оси — левая половина X «>» становится левым углом рамы «<»,
   правая — правым, получается рама-ромб; на тыльной стороне профилей сквозные отверстия.
   Обратно профили переворачиваются разъединёнными («разобранный» X) и сходятся в X.
   Сделано на CSS 3D + Web Animations API: без библиотек, одна анимация и проигрывается, и прокручивается.
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

/* --- Объёмный вариант по эскизу (CSS 3D + Web Animations) --- */
const SKETCH_T = 2200; // полный цикл X → рама → X, мс
// Профили в порядке эскиза: левый верхний, правый верхний, левый нижний, правый нижний.
// cx, cy — центр профиля в долях знака (0–100), r — наклон, dir — куда «наружу» вдоль профиля.
const ARMS = [
  { cx: 29, cy: 29, r: 45, dir: -1 },
  { cx: 71, cy: 29, r: -45, dir: 1 },
  { cx: 29, cy: 71, r: -45, dir: -1 },
  { cx: 71, cy: 71, r: 45, dir: 1 },
];
const SMOOTH = "cubic-bezier(0.65, 0, 0.35, 1)";

function sketchController(svg) {
  const box = document.createElement("span");
  box.className = `${svg.getAttribute("class") || ""} mark3d`;
  box.setAttribute("aria-hidden", "true");
  if (svg.getAttribute("style")) box.setAttribute("style", svg.getAttribute("style"));
  Object.assign(box.dataset, svg.dataset);
  const inner = document.createElement("span");
  inner.className = "mark3d-inner";
  box.append(inner);
  svg.replaceWith(box);

  const at = (ms) => Math.min(ms / SKETCH_T, 1);
  const pose = (r, flip, out, dir) => `rotateY(${flip}deg) rotateZ(${r}deg) translateX(${((out * dir * 100) / 76.4).toFixed(2)}%)`;
  const animations = ARMS.map((arm, i) => {
    const el = document.createElement("span");
    el.className = "arm";
    el.style.setProperty("--cx", arm.cx);
    el.style.setProperty("--cy", arm.cy);
    el.innerHTML = '<i class="f-front"></i><i class="f-back"></i>';
    inner.append(el);
    const s = i * 80; // профили срабатывают по очереди, как на эскизе
    return el.animate(
      [
        { offset: 0, transform: pose(arm.r, 0, 0, arm.dir), easing: SMOOTH },
        { offset: at(200), transform: pose(arm.r, 0, 6, arm.dir), easing: SMOOTH }, // X разделяется на профили
        { offset: at(200 + s), transform: pose(arm.r, 0, 6, arm.dir), easing: SMOOTH },
        { offset: at(720 + s), transform: pose(arm.r, 180, 0, arm.dir), easing: SMOOTH }, // переворот: рама-ромб
        { offset: at(1250 + s), transform: pose(arm.r, 180, 0, arm.dir), easing: SMOOTH },
        { offset: at(1720 + s), transform: pose(arm.r, 360, 13, arm.dir), easing: SMOOTH }, // «разобранный» X
        { offset: 1, transform: pose(arm.r, 360, 0, arm.dir) }, // профили сходятся в X
      ],
      { duration: SKETCH_T, fill: "both" }
    );
  });
  // Лицевая и тыльная (с отверстиями) стороны меняются, когда профиль стоит ребром (90°):
  // не полагаемся на backface-visibility — в Safari он ненадёжен внутри 3D.
  inner.querySelectorAll(".arm").forEach((el, i) => {
    const s = i * 80;
    const flipA = 460 + s; // середина переворота X → рама
    const flipB = 1485 + s; // середина переворота рама → X
    const eps = 0.001;
    const swap = (front) => [
      { offset: 0, opacity: front ? 1 : 0 },
      { offset: at(flipA), opacity: front ? 1 : 0 },
      { offset: at(flipA) + eps, opacity: front ? 0 : 1 },
      { offset: at(flipB), opacity: front ? 0 : 1 },
      { offset: at(flipB) + eps, opacity: front ? 1 : 0 },
      { offset: 1, opacity: front ? 1 : 0 },
    ];
    animations.push(el.querySelector(".f-front").animate(swap(true), { duration: SKETCH_T, fill: "both" }));
    animations.push(el.querySelector(".f-back").animate(swap(false), { duration: SKETCH_T, fill: "both" }));
  });
  // В момент рамы знак слегка разворачивается в перспективе — видна толщина профилей, как на эскизе
  animations.push(
    inner.animate(
      [
        { offset: 0, transform: "rotateX(0deg) rotateY(0deg)" },
        { offset: at(820), transform: "rotateX(0deg) rotateY(0deg)", easing: SMOOTH },
        { offset: at(1050), transform: "rotateX(18deg) rotateY(-24deg)" },
        { offset: at(1300), transform: "rotateX(18deg) rotateY(-24deg)", easing: SMOOTH },
        { offset: at(1550), transform: "rotateX(0deg) rotateY(0deg)" },
        { offset: 1, transform: "rotateX(0deg) rotateY(0deg)" },
      ],
      { duration: SKETCH_T, fill: "both" }
    )
  );
  animations.forEach((a) => a.pause());
  const seekMs = (ms) => animations.forEach((a) => (a.currentTime = ms));
  seekMs(0);
  return {
    box,
    frameAt: 1000 / SKETCH_T,
    seek: (p) => seekMs(Math.min(Math.max(p, 0), 1) * SKETCH_T),
    play() {
      animations.forEach((a) => {
        a.currentTime = 0;
        a.play();
      });
      return Promise.all(animations.map((a) => a.finished)).catch(() => {});
    },
  };
}

// Знаки, которые двигаются: заставка, первый экран, лента бренда, витрина на странице выбора
document.querySelectorAll("[data-mark], [data-scroll-mark], [data-hero-mark], [data-mark-demo] svg").forEach((svg) => {
  const variant = svg.dataset.variant || pageLogo;
  const useSketch = variant === "sketch" && "animate" in Element.prototype;
  const ctl = useSketch ? sketchController(svg) : svgController(svg);
  (ctl.box || svg).mark = ctl;
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
  if (header) {
    header.classList.toggle("is-scrolled", y > 8);
    if (!root.classList.contains("menu-open")) header.classList.toggle("is-hidden", y > lastY + 2 && y > 480);
    if (y < lastY - 2) header.classList.remove("is-hidden");
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

/* Мобильное меню */
const menuButton = document.querySelector("[data-menu-toggle]");
const menu = document.getElementById(menuButton?.getAttribute("aria-controls"));
function setMenu(open) {
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  menu.hidden = !open;
  root.classList.toggle("menu-open", open);
}
if (menuButton && menu) {
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setMenu(false);
      menuButton.focus();
    }
  });
  matchMedia("(min-width: 1024px)").addEventListener("change", (e) => e.matches && setMenu(false));
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

/* Выбор файлов в демо-форме: показываем имена, сами файлы никуда не уходят */
document.querySelectorAll("[data-file-input]").forEach((input) => {
  const list = input.parentElement.querySelector("[data-file-list]");
  input.addEventListener("change", () => {
    list.textContent = [...input.files].map((f) => f.name).join(", ");
  });
});

/* Демо-форма: честно сообщает, что ничего не отправляется */
document.querySelectorAll("[data-demo-form]").forEach((form) =>
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const status = form.querySelector("[data-form-status]");
    status.textContent = "Это концепт: заявка никуда не отправлена. Отправку на почту и в Telegram подключим после согласования адресов и серверной части.";
  })
);

// Запуск в конце файла: к этому моменту все функции и списки элементов уже объявлены.
if (intro && root.classList.contains("intro-on")) playIntro();
else {
  intro?.remove();
  afterIntro();
}
