// Общий скрипт двух концептов FRAMEX: заставка, появление блоков, меню, демо-форма, лента работ.
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* X ↔ рама. Четыре отрезка: в X каждый идёт из центра к углу,
   в раме — от угла к следующему углу. Промежуточные кадры дают «поворот» линий. */
const corners = [[8, 8], [92, 8], [92, 92], [8, 92]];
const center = [50, 50];
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function markPath(t) {
  return corners
    .map((corner, i) => {
      const next = corners[(i + 1) % 4];
      const x1 = mix(center[0], corner[0], t);
      const y1 = mix(center[1], corner[1], t);
      const x2 = mix(corner[0], next[0], t);
      const y2 = mix(corner[1], next[1], t);
      return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
    })
    .join("");
}

function tween(path, from, to, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      path.setAttribute("d", markPath(mix(from, to, ease(t))));
      if (t < 1 && !skipped) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

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
  intro.classList.add("is-leaving");
  pageParts.forEach((el) => (el.inert = false));
  const done = () => {
    root.classList.remove("intro-on");
    intro.remove();
    afterIntro();
  };
  reduceMotion ? done() : setTimeout(done, 600);
}

async function playIntro() {
  // Страховка: в скрытой вкладке кадры анимации не идут, а заставка не должна держать страницу.
  if (document.hidden) return finishIntro();
  setTimeout(finishIntro, 6000);
  document.addEventListener("visibilitychange", () => document.hidden && finishIntro());
  pageParts.forEach((el) => (el.inert = true));
  const skip = intro.querySelector("[data-intro-skip]");
  skip.addEventListener("click", finishIntro);
  document.addEventListener("keydown", (e) => e.key === "Escape" && finishIntro(), { once: true });
  skip.focus({ preventScroll: true });

  const path = intro.querySelector("[data-mark] path");
  intro.classList.add("is-playing");
  await wait(700); // буквы F-R-A-M-E появляются по очереди (CSS)
  await tween(path, 0, 1, 520); // X → рама
  await wait(320);
  await tween(path, 1, 0, 440); // рама → X
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
const marquees = [...document.querySelectorAll("[data-marquee]")].map((el) => ({ el, mark: el.querySelector("[data-scroll-mark] path") }));
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
    if (mark) mark.setAttribute("d", markPath(ease(Math.sin(q * Math.PI))));
  });
  // Глубина: фото внутри рамок смещаются медленнее страницы
  depth.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    const shift = ((r.top + r.height / 2 - vh / 2) * -(+img.dataset.speed || 0.08)).toFixed(1);
    img.style.translate = `0 ${shift}px`;
  });
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
