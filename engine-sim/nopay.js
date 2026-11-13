/*
 * nopay.js — strips every paid/paid-adjacent surface out of this local copy.
 *
 * This build is the public marketing site + simulator. The money surfaces are:
 *   /pricing            plan cards, checkout CTAs
 *   /build, /build/*    the "design your own engine" builder (Pro-gated)
 *   /garage             saved engines (account + cap)
 *   /community          submissions (Pro-gated)
 *   /settings, /welcome account + billing portal
 *   /login              entry point to all of the above
 * plus the in-page "Unlock advanced tuning" / community teaser panels and any
 * Upgrade / See plans / Manage subscription button.
 *
 * Nothing here tries to unlock anything: blocked routes are redirected to the
 * home page and paid UI is hidden or made un-clickable. The free simulator,
 * dyno, engines roster, blog and tools are left alone.
 *
 * Loaded from <head> before the app, so the route guard is in place before
 * React Router reads the URL.
 */
(function () {
  'use strict';

  /* Routes that lead to a paywall, an account, or a checkout. */
  var BLOCKED = [
    /^\/build(\/|$)/,
    /^\/pricing(\/|$)/,
    /^\/garage(\/|$)/,
    /^\/community(\/|$)/,
    /^\/settings(\/|$)/,
    /^\/welcome(\/|$)/,
    /^\/login(\/|$)/
  ];

  /* In-page paywall panels (stable data-testid hooks from the bundle). */
  var HIDE_SELECTORS = [
    '[data-testid="spec-lock"]',        /* "Unlock advanced tuning" */
    '[data-testid="community-teaser"]'  /* blurred community list */
  ];

  /* Links into any blocked area. */
  var HIDE_LINKS = [
    'a[href^="/pricing"]',
    'a[href^="/build"]',
    'a[href^="/garage"]',
    'a[href^="/community"]',
    'a[href^="/settings"]',
    'a[href^="/welcome"]',
    'a[href^="/login"]'
  ].join(',');

  /* Button labels that mean "give us money" (whole-label match, to avoid
     hiding simulator controls). */
  var MONEY_LABEL = /^(upgrade|upgrade now|go pro|get pro|start pro|start max|upgrade to pro|upgrade to max|subscribe|see plans|view plans|view pricing|pricing|plans|manage subscription|manage plan|billing|checkout)$/i;

  function isBlocked(pathname) {
    var p = String(pathname || '/').replace(/\/+$/, '') || '/';
    for (var i = 0; i < BLOCKED.length; i++) if (BLOCKED[i].test(p)) return true;
    return false;
  }

  function goHome() {
    try {
      history.replaceState(history.state, '', '/');
    } catch (err) {
      location.replace('/');
    }
  }

  /* 1. Route guard: direct hits and browser back/forward. */
  if (isBlocked(location.pathname)) goHome();

  /* 2. History guard: client-side navigations (React Router, navigate()). */
  function guarded(fn) {
    return function (state, title, url) {
      try {
        if (url != null) {
          var target = new URL(String(url), location.href);
          if (isBlocked(target.pathname)) {
            return fn.call(history, state, title, '/');
          }
        }
      } catch (err) { /* fall through to the original call */ }
      return fn.apply(history, arguments);
    };
  }
  history.pushState = guarded(history.pushState);
  history.replaceState = guarded(history.replaceState);
  window.addEventListener('popstate', function () {
    if (isBlocked(location.pathname)) goHome();
  });

  /* 3. Small notice instead of silently doing nothing. */
  var toastTimer = null;
  function toast() {
    var el = document.getElementById('x3e-nopay-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'x3e-nopay-toast';
      el.setAttribute('role', 'status');
      el.textContent = 'Paid feature removed in this local copy';
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
        'z-index:2147483647', 'padding:10px 16px', 'border-radius:999px',
        'background:#111820', 'color:#e8eef5', 'border:1px solid #2a3644',
        'font:500 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        'box-shadow:0 8px 24px rgba(0,0,0,.45)', 'pointer-events:none',
        'opacity:0', 'transition:opacity .15s ease'
      ].join(';');
      document.body ? document.body.appendChild(el) : document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(el);
      });
    }
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 1600);
  }

  /* 4. Click guard: links, plus buttons whose label is a checkout CTA. */
  document.addEventListener('click', function (event) {
    var node = event.target;
    if (!node || !node.closest) return;

    var anchor = node.closest('a[href]');
    if (anchor) {
      var target = null;
      try { target = new URL(anchor.getAttribute('href'), location.href); } catch (err) { target = null; }
      if (target && target.origin === location.origin && isBlocked(target.pathname)) {
        event.preventDefault();
        event.stopPropagation();
        toast();
        return;
      }
    }

    var button = node.closest('button,[role="button"],input[type="submit"],input[type="button"]');
    if (button) {
      var label = (button.textContent || button.value || '').trim();
      if (MONEY_LABEL.test(label)) {
        event.preventDefault();
        event.stopPropagation();
        toast();
      }
    }
  }, true);

  /* 5. Style + DOM sweep: hide paid chrome as it renders. */
  function sweep() {
    var i, j, list;

    for (i = 0; i < HIDE_SELECTORS.length; i++) {
      list = document.querySelectorAll(HIDE_SELECTORS[i]);
      for (j = 0; j < list.length; j++) list[j].style.setProperty('display', 'none', 'important');
    }

    list = document.querySelectorAll(HIDE_LINKS);
    for (j = 0; j < list.length; j++) {
      list[j].setAttribute('aria-hidden', 'true');
      list[j].setAttribute('tabindex', '-1');
      list[j].style.setProperty('display', 'none', 'important');
    }

    list = document.querySelectorAll('button,[role="button"]');
    for (j = 0; j < list.length; j++) {
      if (MONEY_LABEL.test((list[j].textContent || '').trim())) {
        list[j].setAttribute('aria-hidden', 'true');
        list[j].style.setProperty('display', 'none', 'important');
      }
    }
  }

  var pending = false;
  function scheduleSweep() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      sweep();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sweep);
  } else {
    sweep();
  }

  /* The app renders after mount, so keep sweeping new nodes. */
  if (window.MutationObserver) {
    new MutationObserver(scheduleSweep).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* Expose the policy so the page itself can be inspected from the console. */
  window.__x3eNoPay = { blocked: BLOCKED, isBlocked: isBlocked, sweep: sweep };
})();
