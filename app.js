async function loadSite() {
  const contentRoot = document.getElementById('site-content');
  const isEnglish = document.documentElement.lang === 'en';
  const locale = isEnglish ? 'en' : 'pl';
  const copyUrl = isEnglish ? 'ui-texts.en.json' : 'ui-texts.json';
  let copy;

  try {
    const [contentResponse, copyResponse] = await Promise.all([
      fetch('page-content.html'),
      fetch(copyUrl)
    ]);
    if (!contentResponse.ok || !copyResponse.ok) {
      throw new Error(`Nie można odczytać plików strony (${contentResponse.status}, ${copyResponse.status}).`);
    }
    [copy, contentRoot.innerHTML] = await Promise.all([
      copyResponse.json(),
      contentResponse.text()
    ]);
    if (isEnglish) {
      const translation = copy.translations;
      const parsedContent = new DOMParser().parseFromString(contentRoot.innerHTML, 'text/html');
      const walker = document.createTreeWalker(parsedContent.body, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        const original = textNode.nodeValue;
        const trimmed = original.trim();
        if (translation[trimmed]) {
          textNode.nodeValue = original.replace(trimmed, translation[trimmed]);
        }
      }
      parsedContent.body.querySelectorAll('*').forEach(element => {
        for (const attribute of ['alt', 'aria-label', 'title']) {
          const value = element.getAttribute(attribute);
          if (value && translation[value]) element.setAttribute(attribute, translation[value]);
        }
      });
      contentRoot.innerHTML = parsedContent.body.innerHTML;
    }
    document.title = copy.pageTitle;
    document.querySelector('meta[name="description"]').content = copy.pageDescription;
  } catch (error) {
    console.error('Błąd ładowania treści strony:', error);
    try {
      const response = await fetch(copyUrl);
      if (response.ok) {
        copy = await response.json();
        contentRoot.textContent = copy.loadError;
      }
    } catch (copyError) {
      console.error('Nie można załadować tekstu błędu:', copyError);
    }
    return;
  }

  const hero = document.getElementById('top');
  const languageSwitch = document.getElementById('languageSwitch');
  if (languageSwitch && isEnglish) {
    languageSwitch.href = 'index2.html';
    languageSwitch.lang = 'pl';
    languageSwitch.setAttribute('aria-label', 'Polski');
    languageSwitch.title = 'Polski';
    languageSwitch.innerHTML = `
      <svg aria-hidden="true" class="h-4 w-6" viewBox="0 0 24 16">
        <path fill="#fff" d="M0 0h24v16H0z"/>
        <path fill="#dc143c" d="M0 8h24v8H0z"/>
        <path fill="none" stroke="rgba(255,255,255,.5)" d="M.5.5h23v15H.5z"/>
      </svg>
      <span class="text-xs font-semibold uppercase">PL</span>
    `;
  }

  const heroSlides = [...hero.querySelectorAll('[data-hero-slide]')];
  const heroIndicators = [...hero.querySelectorAll('[data-hero-indicator]')];
  const heroMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeHeroSlide = 0;
  let heroTimer;
  let heroPointerInside = false;
  let heroHasFocus = false;

  function showHeroSlide(index) {
    activeHeroSlide = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeHeroSlide;
      slide.classList.toggle('opacity-100', active);
      slide.classList.toggle('opacity-0', !active);
    });
    heroIndicators.forEach((indicator, slideIndex) => {
      const active = slideIndex === activeHeroSlide;
      indicator.setAttribute('aria-pressed', String(active));
      indicator.classList.toggle('bg-white', active);
      indicator.classList.toggle('ring-2', active);
      indicator.classList.toggle('ring-white/70', active);
      indicator.classList.toggle('bg-white/50', !active);
    });
  }

  function stopHeroTimer() {
    window.clearInterval(heroTimer);
    heroTimer = undefined;
  }

  function startHeroTimer() {
    stopHeroTimer();
    if (heroMotionPreference.matches || document.hidden || heroPointerInside || heroHasFocus) return;
    heroTimer = window.setInterval(() => showHeroSlide(activeHeroSlide + 1), 4000);
  }

  hero.querySelector('[data-hero-prev]').addEventListener('click', () => {
    showHeroSlide(activeHeroSlide - 1);
    startHeroTimer();
  });
  hero.querySelector('[data-hero-next]').addEventListener('click', () => {
    showHeroSlide(activeHeroSlide + 1);
    startHeroTimer();
  });
  heroIndicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
      showHeroSlide(Number(indicator.dataset.heroIndicator));
      startHeroTimer();
    });
  });
  hero.addEventListener('pointerenter', () => {
    heroPointerInside = true;
    stopHeroTimer();
  });
  hero.addEventListener('pointerleave', () => {
    heroPointerInside = false;
    startHeroTimer();
  });
  hero.addEventListener('focusin', () => {
    heroHasFocus = true;
    stopHeroTimer();
  });
  hero.addEventListener('focusout', event => {
    if (!hero.contains(event.relatedTarget)) {
      heroHasFocus = false;
      startHeroTimer();
    }
  });
  document.addEventListener('visibilitychange', startHeroTimer);
  heroMotionPreference.addEventListener('change', startHeroTimer);
  startHeroTimer();

  const consentApi = window.CookieConsent;
  const mapPlaceholder = document.getElementById('mapPlaceholder');
  const mapStatus = document.getElementById('mapStatus');
  const mapPlaceholderMarkup = mapPlaceholder.innerHTML;

  function updateConsentServices(cookie) {
    const hasMarketingConsent = cookie.categories.includes('marketing');
    const existingMap = mapPlaceholder.querySelector('iframe');

    if (hasMarketingConsent && !existingMap) {
      const map = document.createElement('iframe');
      map.title = copy.mapTitle;
      map.loading = 'lazy';
      map.referrerPolicy = 'no-referrer-when-downgrade';
      map.className = 'h-72 w-full border-0';
      map.src = copy.mapUrl + encodeURIComponent(copy.address) + '&output=embed';
      mapPlaceholder.replaceChildren(map);
      mapStatus.textContent = copy.mapAccepted;
    } else if (!hasMarketingConsent && existingMap) {
      mapPlaceholder.innerHTML = mapPlaceholderMarkup;
      mapStatus.textContent = copy.mapRejected;
      document.getElementById('mapCookieSettings')
        .addEventListener('click', () => consentApi.showPreferences());
    }
  }

  if (consentApi) {
    const t = copy.cookie;
    consentApi.run({
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {},
        marketing: {}
      },
      language: {
        default: locale,
        translations: {
          [locale]: {
            consentModal: {
              title: t.modalTitle,
              description: t.modalDescription,
              acceptAllBtn: t.acceptAll,
              acceptNecessaryBtn: t.rejectAll,
              showPreferencesBtn: t.settings
            },
            preferencesModal: {
              title: t.preferencesTitle,
              acceptAllBtn: t.acceptAll,
              acceptNecessaryBtn: t.rejectAll,
              savePreferencesBtn: t.save,
              closeIconLabel: t.close,
              sections: [
                { title: t.necessaryTitle, description: t.necessaryDescription, linkedCategory: 'necessary' },
                { title: t.analyticsTitle, description: t.analyticsDescription, linkedCategory: 'analytics' },
                { title: t.marketingTitle, description: t.marketingDescription, linkedCategory: 'marketing' },
                { title: t.moreTitle, description: t.moreDescription }
              ]
            }
          }
        }
      },
      guiOptions: {
        consentModal: { layout: 'box inline', position: 'bottom center', equalWeightButtons: true, flipButtons: false },
        preferencesModal: { layout: 'box', position: 'right', equalWeightButtons: true, flipButtons: false }
      },
      onConsent: ({ cookie }) => updateConsentServices(cookie),
      onChange: ({ cookie }) => updateConsentServices(cookie)
    });
  } else {
    console.error('Nie udało się załadować CookieConsent; zewnętrzna mapa pozostaje wyłączona.');
  }

  document.getElementById('mapCookieSettings')
    .addEventListener('click', () => consentApi?.showPreferences());
  document.getElementById('manageCookies')
    .addEventListener('click', () => consentApi?.showPreferences());

  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    menuToggle.setAttribute('aria-label', expanded ? copy.menuOpen : copy.menuClose);
    mobileMenu.classList.toggle('hidden', expanded);
  });
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', copy.menuOpen);
  }));

  const dropdownButton = document.getElementById('serviceDropdownButton');
  const dropdownMenu = document.getElementById('serviceDropdownMenu');
  dropdownButton.addEventListener('click', () => {
    const expanded = dropdownButton.getAttribute('aria-expanded') === 'true';
    dropdownButton.setAttribute('aria-expanded', String(!expanded));
    dropdownMenu.classList.toggle('hidden', expanded);
  });
  dropdownMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    dropdownButton.setAttribute('aria-expanded', 'false');
    dropdownMenu.classList.add('hidden');
  }));
  document.addEventListener('click', event => {
    if (!event.target.closest('#serviceDropdown')) {
      dropdownButton.setAttribute('aria-expanded', 'false');
      dropdownMenu.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      dropdownButton.setAttribute('aria-expanded', 'false');
      dropdownMenu.classList.add('hidden');
      dropdownButton.focus();
    }
  });

  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('site-theme');
  const autoTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ||
    new Date().getHours() >= 19 || new Date().getHours() < 7;

  function setTheme(theme, save = false) {
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    themeToggle.setAttribute('aria-label', theme === 'dark' ? copy.themeLight : copy.themeDark);
    if (save) localStorage.setItem('site-theme', theme);
  }

  setTheme(savedTheme || (autoTheme ? 'dark' : 'light'));
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });

  document.getElementById('currentYear').textContent = new Date().getFullYear();
}

loadSite();
