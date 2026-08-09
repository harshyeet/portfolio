/* ==========================================================================
   MAIN INTERACTIVITY, THEME CONTROLLER & NAVIGATION (HUGO COMPATIBLE)
   ========================================================================== */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. THEME SWITCHER CONTROLLER (LIGHT / DARK 2-STATE)
  // --------------------------------------------------------------------------
  const STORAGE_KEY = 'site-theme';

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    syncSwitcherInputs(theme);
  }

  function syncSwitcherInputs(theme) {
    const inputs = document.querySelectorAll('.switcher__input');
    inputs.forEach(input => {
      input.checked = (input.value === theme);
    });
  }

  // Initialize theme immediately on script load
  const initialTheme = getPreferredTheme();
  setTheme(initialTheme);

  document.addEventListener('DOMContentLoaded', () => {
    syncSwitcherInputs(getPreferredTheme());

    const switcherInputs = document.querySelectorAll('.switcher__input');
    switcherInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.checked) {
          setTheme(e.target.value);
        }
      });
    });

    // Listen for OS theme changes if user hasn't explicitly set a preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });

    // --------------------------------------------------------------------------
    // 2. NAVIGATION HIGHLIGHTING & LOCATION TRACKING
    // --------------------------------------------------------------------------
    highlightCurrentNav();

    // --------------------------------------------------------------------------
    // 3. MOBILE MENU TOGGLE
    // --------------------------------------------------------------------------
    setupMobileMenu();
  });

  function highlightCurrentNav() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http')) return;

      const normalizedHref = href.replace(/\/$/, '') || '/';

      if (path === normalizedHref || (normalizedHref !== '/' && path.startsWith(normalizedHref))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function setupMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-nav-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (!toggleBtn || !mobileMenu) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileMenu.classList.contains('open');
      if (isOpen) {
        mobileMenu.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      } else {
        mobileMenu.classList.add('open');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggleBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
