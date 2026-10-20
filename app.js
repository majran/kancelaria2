async function loadSite() {
  const contentRoot = document.getElementById('site-content');
  let copy;

  try {
    const [contentResponse, copyResponse] = await Promise.all([
      fetch('page-content.html'),
      fetch('ui-texts.json')
    ]);
    if (!contentResponse.ok || !copyResponse.ok) {
      throw new Error(`Nie można odczytać plików strony (${contentResponse.status}, ${copyResponse.status}).`);
    }
    [copy, contentRoot.innerHTML] = await Promise.all([
      copyResponse.json(),
      contentResponse.text()
    ]);
    document.title = copy.pageTitle;
    document.querySelector('meta[name="description"]').content = copy.pageDescription;
  } catch (error) {
    console.error('Błąd ładowania treści strony:', error);
    try {
      const response = await fetch('ui-texts.json');
      if (response.ok) {
        copy = await response.json();
        contentRoot.textContent = copy.loadError;
      }
    } catch (copyError) {
      console.error('Nie można załadować tekstu błędu:', copyError);
    }
    return;
  }

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
        default: 'pl',
        translations: {
          pl: {
            consentModal: {
              title: t.modalTitle,
              description: t.modalDescription,
              acceptAllBtn: t.acceptAll,
              acceptNecessaryBtn: t.rejectAll,
              showPreferencesBtn: t.settings,
              footer: `<a href="#privacy">${t.privacy}</a>`
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
