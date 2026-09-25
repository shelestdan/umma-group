const form = document.querySelector("#contact-form");
const status = document.querySelector("#form-status");
const phoneInput = document.querySelector("#phone");
const fileInput = document.querySelector("#project-files");
const fileList = document.querySelector("#file-list");
const clearFiles = document.querySelector("#clear-files");
const uploadControl = document.querySelector(".upload-control");

function formatRussianPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.startsWith("7")) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  let formatted = "+7";
  if (digits.length > 0) formatted += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) formatted += ")";
  if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`;
  return formatted;
}

if (phoneInput) {
  const validateRussianPhone = () => {
    const digits = phoneInput.value.replace(/\D/g, "");
    phoneInput.setCustomValidity(digits.length === 11 ? "" : "Введите номер в формате +7 (999) 123-45-67");
  };

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatRussianPhone(phoneInput.value);
    validateRussianPhone();
  });

  phoneInput.addEventListener("focus", () => {
    if (!phoneInput.value) phoneInput.value = "+7";
    validateRussianPhone();
  });
}

if (form && status) {
  const showPreviewStatus = () => {
    if (!form.reportValidity()) return;
    status.textContent = "Это предпросмотр формы: заявка и файлы не отправлены.";
  };

  form.querySelector(".button--form").addEventListener("click", showPreviewStatus);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showPreviewStatus();
  });
}

if (fileInput && fileList && clearFiles && uploadControl) {
  const fileSize = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

  function renderSelectedFiles() {
    fileList.replaceChildren();
    Array.from(fileInput.files).forEach((file) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const size = document.createElement("span");
      name.textContent = file.name;
      size.textContent = file.size < 1024
        ? "< 1 КБ"
        : file.size < 1024 * 1024
          ? `${Math.ceil(file.size / 1024)} КБ`
          : `${fileSize.format(file.size / 1024 / 1024)} МБ`;
      item.append(name, size);
      fileList.append(item);
    });
    clearFiles.hidden = fileInput.files.length === 0;
  }

  fileInput.addEventListener("change", renderSelectedFiles);
  clearFiles.addEventListener("click", () => {
    fileInput.value = "";
    renderSelectedFiles();
    fileInput.focus();
  });

  uploadControl.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadControl.classList.add("is-dragging");
  });
  uploadControl.addEventListener("dragleave", () => uploadControl.classList.remove("is-dragging"));
  uploadControl.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadControl.classList.remove("is-dragging");
    if (!event.dataTransfer.files.length) return;
    fileInput.files = event.dataTransfer.files;
    renderSelectedFiles();
  });
}

document.querySelectorAll(".faq-question").forEach((question) => {
  question.addEventListener("click", () => {
    const expanded = question.getAttribute("aria-expanded") === "true";
    const answer = document.getElementById(question.getAttribute("aria-controls"));
    question.setAttribute("aria-expanded", String(!expanded));
    question.closest(".faq-item").classList.toggle("is-open", !expanded);
    answer.setAttribute("aria-hidden", String(expanded));
    answer.inert = expanded;
  });
});

const slides = [
  ["assets/hero-sibur.png", "Выставочный стенд в выставочном пространстве"],
  ["assets/hero-detail.png", "Деталь выставочного стенда"],
  ["assets/project-rosneft.png", "Выставочное пространство"],
  ["assets/project-lukoil.png", "Выставочное пространство"],
];
const heroImage = document.querySelector("#hero-image");
let currentSlide = 0;

// ponytail: four local image slides; add a content source when real portfolio data arrives.
console.assert(slides.length === 4, "Slider needs four slides");

function showSlide(nextSlide) {
  currentSlide = (nextSlide + slides.length) % slides.length;
  const [src, alt] = slides[currentSlide];
  heroImage.style.opacity = "0";
  window.setTimeout(() => {
    heroImage.src = src;
    heroImage.alt = alt;
    heroImage.style.opacity = "1";
  }, 100);
}

document.querySelector("[data-slide='previous']")?.addEventListener("click", () => showSlide(currentSlide - 1));
document.querySelector("[data-slide='next']")?.addEventListener("click", () => showSlide(currentSlide + 1));

const serviceData = {
  exhibition: {
    image: "assets/works/maer-vef-04.webp",
    alt: "Выставочный стенд MAER на ВЭФ 2024",
    title: "Архитектура, свет и медиа.",
    description: "Проектируем, производим и монтируем выставочные стенды и бренд-зоны.",
    project: "MAER · ВЭФ 2024",
  },
  retail: {
    image: "assets/service-retail-concept.webp",
    alt: "Концептуальная визуализация торгового пространства",
    title: "Планировка, витрины, свет.",
    description: "Разрабатываем оформление магазинов и шоурумов под задачи бренда.",
    project: "Концепт торгового пространства",
  },
  events: {
    image: "assets/works/vk-kvartirnik-04.webp",
    alt: "Брендированная зона ВК Квартирника 2025",
    title: "Сцена, зоны, детали.",
    description: "Оформляем площадку, зоны для гостей и брендированные элементы события.",
    project: "ВК Квартирник · 2025",
  },
};

const serviceTabs = document.querySelectorAll(".service-tab[data-service]");
const serviceStage = document.querySelector("#service-stage");
const serviceImage = document.querySelector("#service-stage-image");
const serviceTitle = document.querySelector("#service-stage-title");
const serviceDescription = document.querySelector("#service-stage-description");
const serviceProject = document.querySelector("#service-stage-project");
const serviceFadeDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
let serviceUpdate = 0;

async function selectService(serviceKey, trigger) {
  const service = serviceData[serviceKey];
  if (!service || !serviceStage) return;
  if (serviceStage.dataset.service === serviceKey && !serviceStage.hasAttribute("aria-busy")) return;

  serviceTabs.forEach((tab) => {
    const selected = tab === trigger;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  serviceStage.setAttribute("aria-labelledby", trigger.id);

  const update = ++serviceUpdate;
  serviceStage.classList.remove("is-changing");
  serviceStage.setAttribute("aria-busy", "true");
  const nextImage = new Image();
  nextImage.src = service.image;
  try {
    await nextImage.decode();
  } catch {
    // The image element still provides its alt text if loading fails.
  }
  if (update !== serviceUpdate) return;

  serviceStage.classList.add("is-changing");
  window.setTimeout(() => {
    if (update !== serviceUpdate) return;
    serviceImage.src = service.image;
    serviceImage.alt = service.alt;
    serviceTitle.textContent = service.title;
    serviceDescription.textContent = service.description;
    serviceProject.textContent = service.project;
    serviceStage.dataset.service = serviceKey;
    serviceStage.classList.remove("is-changing");
    serviceStage.removeAttribute("aria-busy");
  }, serviceFadeDuration);
}

serviceTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectService(tab.dataset.service, tab));

  tab.addEventListener("keydown", (event) => {
    const currentIndex = Array.from(serviceTabs).indexOf(tab);
    const lastIndex = serviceTabs.length - 1;
    let nextIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = serviceTabs[nextIndex];
    nextTab.focus();
    selectService(nextTab.dataset.service, nextTab);
  });
});

const workDialog = document.querySelector("#work-dialog");

if (workDialog && typeof workDialog.showModal === "function") {
  document.documentElement.classList.add("js-gallery");

  const dialogTitle = document.querySelector("#work-dialog-title");
  const dialogEvent = document.querySelector("#work-dialog-event");
  const dialogImage = document.querySelector("#work-dialog-image");
  const dialogCounter = document.querySelector("#work-dialog-counter");
  const dialogThumbs = document.querySelector("#work-dialog-thumbs");
  const closeButton = workDialog.querySelector("[data-gallery-close]");
  let galleryPhotos = [];
  let galleryIndex = 0;
  let galleryOpener = null;

  function showGalleryPhoto(nextIndex) {
    galleryIndex = (nextIndex + galleryPhotos.length) % galleryPhotos.length;
    const photo = galleryPhotos[galleryIndex];
    dialogImage.src = photo.href;
    dialogImage.alt = photo.querySelector("img").alt;
    dialogCounter.textContent = `Фото ${galleryIndex + 1} из ${galleryPhotos.length}`;

    dialogThumbs.querySelectorAll("button").forEach((button, index) => {
      button.classList.toggle("is-active", index === galleryIndex);
      button.setAttribute("aria-current", index === galleryIndex ? "true" : "false");
    });
  }

  function openGallery(work, photoOrder, opener) {
    galleryPhotos = Array.from(work.querySelectorAll("[data-project-photo]")).sort(
      (a, b) => Number(a.dataset.photoOrder) - Number(b.dataset.photoOrder),
    );
    galleryOpener = opener;
    dialogTitle.textContent = work.querySelector(".work-title").textContent;
    dialogEvent.textContent = work.querySelector(".work-event").textContent.trim();
    dialogThumbs.replaceChildren();

    galleryPhotos.forEach((photo, index) => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      button.type = "button";
      button.setAttribute("aria-label", `Фото ${index + 1} из ${galleryPhotos.length}`);
      image.src = photo.href;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
      button.addEventListener("click", () => showGalleryPhoto(index));
      dialogThumbs.append(button);
    });

    workDialog.showModal();
    document.body.classList.add("gallery-open");
    showGalleryPhoto(galleryPhotos.findIndex((photo) => Number(photo.dataset.photoOrder) === photoOrder));
    closeButton.focus();
  }

  document.querySelectorAll(".work [data-open-gallery], .work [data-project-photo]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openGallery(link.closest(".work"), Number(link.dataset.photoOrder || 1), link);
    });
  });

  closeButton.addEventListener("click", () => workDialog.close());
  workDialog.querySelector("[data-gallery-previous]").addEventListener("click", () => showGalleryPhoto(galleryIndex - 1));
  workDialog.querySelector("[data-gallery-next]").addEventListener("click", () => showGalleryPhoto(galleryIndex + 1));
  workDialog.addEventListener("close", () => {
    document.body.classList.remove("gallery-open");
    galleryOpener?.focus();
  });
  workDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showGalleryPhoto(galleryIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(".reveal");

if (!reduceMotion && "IntersectionObserver" in window) {
  document.documentElement.classList.add("js-motion");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8%" },
  );
  revealItems.forEach((item) => observer.observe(item));
}

const siteHeader = document.querySelector(".site-header");
const menuButton = document.querySelector(".mobile-menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const pageMain = document.querySelector("main");
let menuOpen = false;
let lastScrollDecisionY = Math.max(0, window.scrollY);
let headerFramePending = false;

function setMenuOpen(open, restoreFocus = false) {
  if (!siteHeader || !menuButton || !mobileNav) return;
  menuOpen = open;
  siteHeader.classList.toggle("is-menu-open", open);
  siteHeader.classList.remove("is-hidden");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  menuButton.querySelector(".mobile-menu-label").textContent = open ? "Закрыть" : "Меню";
  mobileNav.classList.toggle("is-open", open);
  mobileNav.setAttribute("aria-hidden", String(!open));
  mobileNav.inert = !open;
  document.body.classList.toggle("menu-open", open);
  if (pageMain) pageMain.inert = open;
  lastScrollDecisionY = Math.max(0, window.scrollY);

  if (open) mobileNav.querySelector("a")?.focus({ preventScroll: true });
  else if (restoreFocus) menuButton.focus({ preventScroll: true });
}

function updateHeaderOnScroll() {
  if (!siteHeader) return;
  const scrollY = Math.max(0, window.scrollY);
  siteHeader.classList.toggle("is-scrolled", scrollY > 8);

  if (menuOpen || scrollY <= siteHeader.offsetHeight + 40) {
    siteHeader.classList.remove("is-hidden");
    lastScrollDecisionY = scrollY;
  } else if (Math.abs(scrollY - lastScrollDecisionY) >= 12) {
    siteHeader.classList.toggle("is-hidden", scrollY > lastScrollDecisionY);
    lastScrollDecisionY = scrollY;
  }
  headerFramePending = false;
}

if (siteHeader && menuButton && mobileNav) {
  menuButton.addEventListener("click", () => setMenuOpen(!menuOpen, menuOpen));
  mobileNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) setMenuOpen(false, true);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && menuOpen) setMenuOpen(false);
  });
  window.addEventListener("scroll", () => {
    if (headerFramePending) return;
    headerFramePending = true;
    window.requestAnimationFrame(updateHeaderOnScroll);
  }, { passive: true });
  updateHeaderOnScroll();
}
