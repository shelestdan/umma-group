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
  if (reduceMotion) return;
  document.querySelectorAll("[data-type-after-intro]").forEach((el) => {
    el.textContent = "";
    setTimeout(() => typeText(el, 90), 450);
  });
}

if (intro && root.classList.contains("intro-on")) playIntro();
else {
  intro?.remove();
  afterIntro();
}

/* Появление блоков при прокрутке */
const revealItems = document.querySelectorAll("[data-reveal]");
if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }),
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  revealItems.forEach((el) => observer.observe(el));
} else revealItems.forEach((el) => el.classList.add("is-in"));

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
