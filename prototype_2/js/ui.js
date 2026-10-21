/* Shared UI: safe HTML templating, formatting, toasts, theme, header/footer. */
(function () {
  const MF = (window.MF = window.MF || {});

  // ---- safe templating: every interpolated value is escaped unless it came from another h`` call ----
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const part = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join('') : v == null || v === false ? '' : esc(v));
  const h = (strs, ...vals) => new Safe(strs.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));
  const raw = (s) => new Safe(s);

  // ---- formatting ----
  const peso = (n) => {
    const v = Number(n || 0);
    return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  };
  const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
  const fullName = (u, fallback) => ((u && (u.first_name + ' ' + u.last_name).trim()) || fallback || 'Muralla Tech user');
  const methodLabel = (m) => ({ gcash: 'GCash', maya: 'Maya', meetup: 'Meet-up (arranged directly)' }[m] || m);
  const round2 = (n) => Math.round(n * 100) / 100;

  const STATUS = {
    pending: ['Awaiting seller', 'pill--warn'],
    confirmed: ['Confirmed', 'pill--ok'],
    awaiting_payment: ['Awaiting payment', 'pill--warn'],
    payment_submitted: ['Payment submitted', 'pill--warn'],
    payment_confirmed: ['Payment confirmed', 'pill--ok'],
    payment_rejected: ['Payment rejected', 'pill--danger'],
    completed: ['Completed', 'pill--ok'],
    cancelled: ['Cancelled', 'pill--danger'],
  };
  const PAYOUT = { not_due: ['Not due yet', 'pill--muted'], pending_release: ['Pending release', 'pill--warn'], released: ['Released', 'pill--ok'] };
  const statusPill = (s) => h`<span class="pill ${(STATUS[s] || STATUS.pending)[1]}">${(STATUS[s] || STATUS.pending)[0]}</span>`;
  const payoutPill = (s) => h`<span class="pill ${(PAYOUT[s] || PAYOUT.not_due)[1]}">${(PAYOUT[s] || PAYOUT.not_due)[0]}</span>`;

  // ---- icons (feather-style paths) ----
  const IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01"/>',
    truck: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    spec: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    chip: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    reset: '<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  };
  const icon = (name, size) => raw('<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[name] + '</svg>');

  // ---- paths ----
  const url = (p) => (!p || /^(data:|https?:|blob:)/.test(p) ? p : MF.root + p); // seed photos are stored relative to the app root
  const page = (name) => MF.root + (name === 'index' ? 'index.html' : 'pages/' + name + '.html');
  const here = () => (MF.root ? 'pages/' : '') + location.pathname.split('/').pop() + location.search;
  const params = () => new URLSearchParams(location.search);

  // ---- toast ----
  let toastWrap;
  function toast(text, isError) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      toastWrap.setAttribute('role', 'status');
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' toast--err' : '');
    t.textContent = text;
    toastWrap.appendChild(t);
    setTimeout(() => t.remove(), isError ? 6000 : 3500);
  }

  const notice = (type, content) => h`<div class="notice notice--${type}" role="${type === 'error' ? 'alert' : 'status'}"><span>${content}</span></div>`;

  // Shrinks a chosen photo to a small JPEG data URL so a few of them fit in localStorage.
  function fileToDataUrl(file, max, quality) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG, JPG or WebP).'));
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, (max || 900) / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(src);
        resolve(c.toDataURL('image/jpeg', quality || 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('That image could not be read.')); };
      img.src = src;
    });
  }

  // Event delegation: elements carry data-act="name" (click) or forms carry data-form="name" (submit).
  function wire(root, clicks, forms) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (el && root.contains(el) && clicks[el.getAttribute('data-act')]) clicks[el.getAttribute('data-act')](el, e);
    });
    if (forms) {
      root.addEventListener('submit', (e) => {
        const f = e.target.closest('[data-form]');
        if (f && forms[f.getAttribute('data-form')]) { e.preventDefault(); forms[f.getAttribute('data-form')](f, e); }
      });
    }
  }

  // ---- theme: data-theme on <html>; the pre-paint part lives in js/theme-init.js ----
  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = dark === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('mf2_theme', next); } catch (e) { /* the switch still applies for this visit */ }
  }

  // ---- header / footer ----
  function mountShell() {
    const user = MF.auth.current();
    const root = MF.root;
    const cartCount = MF.cart.count();
    const role = user ? user.role : '';
    const staff = role === 'seller' || role === 'admin';
    const todo = user && staff ? MF.pay.sellerTodo(user.id) : 0;
    const unread = user ? MF.pay.unread(user.id) : 0;
    const roleLabel = { admin: 'ADMIN', seller: 'SELLER', buyer: 'BUYER' }[role];
    const initial = user ? user.first_name[0].toUpperCase() : '';
    const acct = (tab, ic, label, extra) => h`<a class="header-dropdown-item" role="menuitem" href="${page('orders')}?tab=${tab}">${icon(ic, 16)}<span>${label}</span>${extra || ''}</a>`;

    document.getElementById('mf-header').innerHTML = h`
    <a class="skip-link" href="#app">Skip to content</a>
    <header class="site-header">
      <div class="wrap header-inner">
        <button type="button" class="icon-btn hamburger" aria-label="Menu" aria-expanded="false" data-nav-toggle>${icon('menu')}</button>
        <a class="brand" href="${page('index')}"><img src="${root}assets/icon.png" alt="" width="35" height="40"><span class="brand-word"><span class="m">Muralla</span> <span class="f">Tech</span></span><span class="visually-hidden"> home</span></a>
        <nav class="nav-links" aria-label="Main" data-navlinks>
          <a href="${page('browse')}">Browse</a>
          <a href="${page('browse')}?type=surplus">Surplus deals</a>
          <a href="${page('index')}#how">How it works</a>
          <button type="button" class="nav-theme" data-theme-flip>Switch light / dark theme</button>
        </nav>
        <div class="header-search" role="search">
          ${icon('search', 16)}
          <input type="search" aria-label="Search electronics" placeholder="Search electronics…" data-header-search>
        </div>
        <div class="header-actions">
          <a class="btn btn--primary btn--sm" href="${page('sell')}" style="margin-right:4px">${icon('plus', 15)} Sell</a>
          <button type="button" class="icon-btn" data-theme-toggle data-theme-flip aria-label="Toggle light / dark theme">${icon('sun')}</button>
          <a class="icon-btn" href="${page('orders')}?tab=saved" aria-label="Saved items">${icon('heart')}</a>
          <a class="icon-btn" href="${page('cart')}" aria-label="Cart${cartCount ? ', ' + cartCount + ' items' : ''}">${icon('bag')}${cartCount ? h`<span class="badge-count">${cartCount}</span>` : ''}</a>
          ${!user ? h`<div style="display:flex;align-items:center;gap:8px;margin-left:6px">
              <a class="btn btn--ghost btn--sm" href="${page('login')}?next=${encodeURIComponent(here())}">Log In</a>
              <a class="btn btn--primary btn--sm" href="${page('login')}?mode=signup">Sign Up</a></div>` : h`
            <div class="header-profile-menu-wrap">
              <button type="button" class="header-user-btn" aria-haspopup="true" aria-expanded="false" aria-label="User account menu" data-menu-toggle>
                <span class="header-avatar-wrap"><span class="header-avatar">${initial}</span>${todo ? h`<span class="header-avatar-dot" aria-hidden="true"></span>` : ''}</span>
                <span class="header-user-btn-name">${user.first_name}</span>${icon('chev', 14)}
              </button>
              <div class="header-dropdown-menu" role="menu" data-menu hidden>
                <div class="header-dropdown-header">
                  <div class="header-avatar header-avatar--lg">${initial}</div>
                  <div class="header-dropdown-user-info">
                    <div class="header-dropdown-name">${fullName(user)}</div>
                    <div class="header-dropdown-email">${user.email}</div>
                    <div style="margin-top:4px"><span class="header-role-badge header-role-badge--${role === 'buyer' ? 'customer' : role}">${roleLabel}</span></div>
                  </div>
                </div>
                <div class="header-dropdown-divider"></div>
                <div class="header-dropdown-section">
                  ${acct('orders', 'bag', 'My Orders')}
                  ${acct('notifications', 'chip', 'Notifications', unread ? h`<span class="count-badge">${unread}</span>` : '')}
                  ${acct('saved', 'heart', 'Saved Items')}
                  ${acct('settings', 'user', 'Account Settings')}
                </div>
                <div class="header-dropdown-divider"></div>
                <div class="header-dropdown-section">
                  <div class="header-dropdown-section-title">STOREFRONT &amp; SELLING</div>
                  ${staff ? h`
                    ${acct('seller-orders', 'truck', 'Incoming Orders', todo ? h`<span class="count-badge">${todo}</span>` : '')}
                    ${acct('listings', 'tag', 'My Listings')}
                    <a class="header-dropdown-item" role="menuitem" href="${page('sell')}">${icon('plus', 16)}<span>List New Item</span></a>` : h`
                    <a class="header-dropdown-item" role="menuitem" href="${page('sell')}">${icon('tag', 16)}<span>Open a Storefront</span></a>`}
                </div>
                ${role === 'admin' ? h`<div class="header-dropdown-divider"></div><div class="header-dropdown-section">
                  <div class="header-dropdown-section-title">ADMINISTRATION</div>
                  <a class="header-dropdown-item header-dropdown-item--admin" role="menuitem" href="${page('admin')}">${icon('spec', 16)}<span>Admin Control Panel</span></a></div>` : ''}
                <div class="header-dropdown-divider"></div>
                <div class="header-dropdown-section"><button type="button" class="header-dropdown-item header-dropdown-item--logout" role="menuitem" data-logout>${icon('arrow', 16)}<span>Log Out</span></button></div>
              </div>
            </div>`}
        </div>
      </div>
    </header>`;

    document.getElementById('mf-footer').innerHTML = h`
    <footer class="site-footer">
      <div class="wrap footer-grid footer-grid--lean">
        <div class="footer-brand"><img class="footer-logo" src="${root}assets/logo.png" alt="Muralla Tech" width="150" height="160">
          <p>Metro Manila&rsquo;s tech &amp; electronics marketplace for preloved gadgets and surplus deals. Buy, sell, meet up, or ship - all in one place.</p></div>
        <div class="footer-col"><h4>Shop</h4><a href="${page('browse')}">Browse all</a><a href="${page('browse')}?type=surplus">Surplus deals</a><a href="${page('browse')}?type=preloved">Preloved finds</a></div>
        <div class="footer-col"><h4>Sell</h4><a href="${page('sell')}">List an item</a><a href="${page('index')}#how">How it works</a><a href="${page('orders')}?tab=listings">My listings</a></div>
      </div>
      <div class="wrap footer-bottom">
        <span>&copy; 2026 Muralla Tech &middot; prototype 2 (demo, mock payments only) &middot; <button type="button" class="linkbtn" data-reset-demo>Reset demo data</button></span>
        <div class="footer-pay"><span>GCash</span><span>Maya</span><span>Cash at meet-up</span></div>
      </div>
    </footer>
    <button type="button" class="reset-fab" data-reset-presentation aria-label="Reset presentation to its initial state">${icon('reset', 18)}<span>Reset</span></button>
    <nav class="mobile-nav" aria-label="Primary">
      <a href="${page('index')}">${icon('home')}Home</a>
      <a href="${page('browse')}">${icon('search')}Browse</a>
      <a href="${page('sell')}">${icon('plus')}Sell</a>
      <a href="${page('orders')}?tab=saved">${icon('heart')}Saved</a>
      <a href="${user ? page('orders') : page('login')}">${icon('user')}${user ? 'Account' : 'Log in'}</a>
    </nav>`;

    // behaviour
    const hdr = document.getElementById('mf-header');
    const menu = hdr.querySelector('[data-menu]');
    const mbtn = hdr.querySelector('[data-menu-toggle]');
    const setMenu = (open) => { if (menu) { menu.hidden = !open; mbtn.setAttribute('aria-expanded', String(open)); } };
    if (mbtn) mbtn.addEventListener('click', () => setMenu(menu.hidden));
    document.addEventListener('mousedown', (e) => { if (menu && !menu.hidden && !menu.parentNode.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); mbtn.focus(); } });
    hdr.querySelectorAll('[data-theme-flip]').forEach((b) => b.addEventListener('click', toggleTheme));
    const nav = hdr.querySelector('[data-navlinks]');
    const burger = hdr.querySelector('[data-nav-toggle]');
    burger.addEventListener('click', () => burger.setAttribute('aria-expanded', String(nav.classList.toggle('is-open'))));
    hdr.querySelector('[data-header-search]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const q = e.target.value.trim(); location.href = page('browse') + (q ? '?q=' + encodeURIComponent(q) : ''); }
    });
    const lo = hdr.querySelector('[data-logout]');
    if (lo) lo.addEventListener('click', () => { MF.auth.logout(); location.href = page('index'); });
    // Fixed bottom-right: wipes all demo data, the login, the cart and the saved theme, then returns to the home page.
    document.querySelector('[data-reset-presentation]').addEventListener('click', () => {
      MF.db.reset();
      MF.storage.remove('theme');
      document.documentElement.removeAttribute('data-theme');
      location.href = page('index');
    });
    document.querySelector('[data-reset-demo]').addEventListener('click', () => {
      if (!document.querySelector('[data-reset-ask]')) {
        const b = document.querySelector('[data-reset-demo]');
        b.insertAdjacentHTML('afterend', ' <span data-reset-ask>Erase all demo data? <button type="button" class="linkbtn" data-reset-yes>Yes, reset</button></span>');
        document.querySelector('[data-reset-yes]').addEventListener('click', () => { MF.db.reset(); location.href = page('index'); });
      }
    });
  }

  // Page boot: wait for the seed, draw the shell, then run the page. Anything that throws shows a message instead of a blank page.
  function boot(fn) {
    MF.ready.then(() => { mountShell(); return fn(); }).catch((e) => {
      console.error(e);
      const app = document.getElementById('app');
      if (app) app.innerHTML = '<div class="wrap section"><div class="notice notice--error" role="alert"><span>Could not load the demo data. If you opened this file directly, make sure data/seed.js exists (run <code>python tools/build_seed.py</code>) or serve the folder with any static server.</span></div></div>';
    });
  }

  MF.ui = { h, raw, esc, peso, dateTime, fullName, methodLabel, round2, statusPill, payoutPill, STATUS, icon, url, page, here, params, toast, notice, fileToDataUrl, wire, toggleTheme, mountShell, boot };
})();
