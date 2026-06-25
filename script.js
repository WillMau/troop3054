/* ============================================
   Troop 3054 — Site Scripts
   ============================================ */

(function () {
  'use strict';

  /* ---------- DOM Ready ---------- */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initNavigation();
    initDropdowns();
    initScrollEffects();
    initFAQ();
    initFadeAnimations();
    initContactForm();
    initSponsorForm();
    setActiveNavLink();
  }

  /* ---------- Navigation ---------- */
  function initNavigation() {
    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    var overlay = document.querySelector('.nav-overlay');

    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    if (overlay) {
      overlay.addEventListener('click', closeMenu);
    }

    // Close menu on link click (mobile)
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        closeMenu();
      }
    });

    function closeMenu() {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';

      // Collapse any open dropdowns when the mobile menu closes
      document.querySelectorAll('.nav-dropdown.open').forEach(function (dd) {
        dd.classList.remove('open');
        var t = dd.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  }

  /* ---------- Resources Dropdown ---------- */
  function initDropdowns() {
    var toggles = document.querySelectorAll('.nav-dropdown-toggle');
    if (!toggles.length) return;

    toggles.forEach(function (toggle) {
      // On mobile the menu is an accordion driven by the .open class.
      // On desktop the menu opens on hover/focus, so this just adds tap support.
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        var dropdown = toggle.closest('.nav-dropdown');
        var isOpen = dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  /* ---------- Scroll Effects ---------- */
  function initScrollEffects() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;

    var scrollThreshold = 60;

    function onScroll() {
      if (window.scrollY > scrollThreshold) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Check initial state
  }

  /* ---------- FAQ Accordion ---------- */
  function initFAQ() {
    var faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;

      question.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');

        // Close all others
        faqItems.forEach(function (other) {
          other.classList.remove('open');
          var otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        });

        // Toggle current
        if (!isOpen) {
          item.classList.add('open');
          question.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Intersection Observer Fade Animations ---------- */
  function initFadeAnimations() {
    var animatedElements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
    if (!animatedElements.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything
      animatedElements.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- Contact Form ---------- */
  function initContactForm() {
    var form = document.querySelector('#contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (response) {
        if (response.ok) {
          form.style.display = 'none';
          var successEl = document.getElementById('contact-success');
          if (successEl) successEl.classList.add('show');
        } else {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          alert('Something went wrong. Please try again or reach out on the Band app.');
        }
      }).catch(function () {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        alert('Something went wrong. Please try again or reach out on the Band app.');
      });
    });
  }

  /* ---------- Sponsor Form ---------- */
  function initSponsorForm() {
    var form = document.getElementById('sponsor-form');
    var levelSelect = document.getElementById('sponsor-level');
    if (!form || !levelSelect) return;

    // Tier selection buttons pre-fill the dropdown
    document.querySelectorAll('.sponsor-select-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = btn.getAttribute('data-tier');
        if (tier) {
          levelSelect.value = tier;
        }
      });
    });

    // Handle form submission via Formspree (AJAX)
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (response) {
        if (response.ok) {
          form.style.display = 'none';
          var successEl = document.getElementById('sponsor-success');
          if (successEl) successEl.classList.add('show');
        } else {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          alert('Something went wrong. Please try again or contact us directly.');
        }
      }).catch(function () {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        alert('Something went wrong. Please try again or contact us directly.');
      });
    });
  }

  /* ---------- Active Nav Link ---------- */
  function setActiveNavLink() {
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');

        // If the active page lives in the Resources dropdown, highlight the toggle too
        var dropdown = link.closest('.nav-dropdown');
        if (dropdown) dropdown.classList.add('active-parent');
      }
    });
  }

  /* ---------- Smooth scroll for anchor links ---------- */
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    var targetId = anchor.getAttribute('href');
    if (targetId === '#') return;

    var target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      var navHeight = document.querySelector('.site-nav')
        ? document.querySelector('.site-nav').offsetHeight
        : 0;
      var targetPos = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
      window.scrollTo({ top: targetPos, behavior: 'smooth' });
    }
  });
})();
