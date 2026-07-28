/* ==========================================================================
   MAIN INTERACTIVITY, THEME CONTROLLER & NAVIGATION
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

    // --------------------------------------------------------------------------
    // 4. HOMEPAGE RECENT POSTS WIDGET LOADER
    // --------------------------------------------------------------------------
    loadRecentPostsWidget();
  });

  function highlightCurrentNav() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');

      if (!href) return;

      // Home check
      if ((path === '/' || path.endsWith('/index.html') && !path.includes('/blogs/') && !path.includes('/contact/')) && (href === '/' || href.endsWith('/index.html') && href.length <= 11)) {
        link.classList.add('active');
      }
      // Blogs check
      else if (path.includes('/blogs/') && href.includes('/blogs/')) {
        link.classList.add('active');
      }
      // Contact check
      else if (path.includes('/contact/') && href.includes('/contact/')) {
        link.classList.add('active');
      }
    });
  }

  function setupMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-nav-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (!toggleBtn || !mobileMenu) return;

    toggleBtn.addEventListener('click', () => {
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

  function loadRecentPostsWidget() {
    const widgetContainer = document.getElementById('recent-posts-list');
    if (!widgetContainer) return;

    fetch('blogs/manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Manifest not found');
        return res.json();
      })
      .then(posts => {
        if (!posts || posts.length === 0) {
          widgetContainer.innerHTML = '<li class="post-mini-item">no posts found</li>';
          return;
        }

        // Render up to 3 recent posts
        const recent = posts.slice(0, 3);
        widgetContainer.innerHTML = recent.map(post => `
          <li class="post-mini-item">
            <a href="blogs/${post.filename}">${escapeHtml(post.title)}</a>
            <span class="post-mini-date">${escapeHtml(post.date)}</span>
          </li>
        `).join('');
      })
      .catch(err => {
        console.warn('Failed to load recent posts:', err);
        // Fallback static rendering if fetch fails on local file protocol without server
      });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
