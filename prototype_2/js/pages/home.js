/* Home: hero with search + carousel of the newest listings, stats, Newest devices (tabbed), How it works, sell CTA. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page } = MF.ui;
  const approved = MF.listings.approved();
  const newest = approved.filter((l) => l.photos && l.photos[0]).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);

  const sellers = new Set(approved.map((l) => l.seller_id)).size;
  const TABS = [['', 'All'], ['preloved', 'Preloved'], ['surplus', 'Surplus']];
  const byNewest = (type) => approved.filter((l) => !type || l.type === type).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);

  document.getElementById('app').innerHTML = h`
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero-inner">
      <div>
        <p class="eyebrow">Tech &amp; electronics marketplace</p>
        <h1 id="hero-title">Premium tech. <span class="g">Fair</span> prices.</h1>
        <p class="lead">Shop the latest cameras, gaming gear, audio and PC parts, plus preloved gadgets, from trusted sellers across Metro Manila.</p>
        <form class="searchbar" role="search" data-hero-search>
          <input type="search" name="q" aria-label="Search electronics" placeholder="What are you looking for?">
          <button type="submit" class="btn btn--primary" style="padding:.6rem 1.1rem">Search</button>
        </form>
        <div class="hero-cta">
          <a class="btn btn--primary" href="${page('browse')}">Shop now</a>
          <a class="btn btn--outline-light" href="#how">How it works</a>
        </div>
        <div class="hero-chips">
          ${['iPhone', 'AirPods', 'Power bank', 'Nintendo'].map((q) => h`<a href="${page('browse')}?q=${encodeURIComponent(q)}" class="chip-link">${q}</a>`)}
        </div>
      </div>
      <div class="hero-collage">
        <div class="hero-carousel" data-carousel aria-roledescription="carousel" aria-label="Latest listings"></div>
        <div class="float-tag"><div class="dot"></div> Safe meetup spots</div>
      </div>
    </div>
  </section>

  <section class="wrap stats-row" aria-label="Marketplace at a glance">
    <div class="stat stat--dark"><b data-stat="total">${approved.length}</b><span>Items Listed</span></div>
    <div class="stat stat--lime"><b>${sellers}</b><span>Active sellers</span></div>
    <div class="stat stat--dark"><b>100%</b><span>Metro Manila</span></div>
  </section>

  <section class="wrap section" aria-labelledby="new-title">
    <div class="section-head"><h2 id="new-title">Newest devices</h2>
      <a href="${page('browse')}" class="link">See all ${icon('arrow', 16)}</a></div>
    <div class="pill-tabs" role="group" aria-label="Filter newest devices">
      ${TABS.map(([v, label], i) => h`<button type="button" class="pill-tab" data-tab="${v}" aria-pressed="${String(i === 0)}">${label}</button>`)}
    </div>
    <div class="scroller" data-newest></div>
  </section>

  <section class="wrap section" id="how">
    <div class="section-head"><h2>How it works</h2></div>
    <div class="steps">
      <div class="step"><div class="n">01</div><h3>Find it</h3><p>Search preloved and surplus electronics and filter by condition, brand and price. Save the ones you like.</p></div>
      <div class="step"><div class="n">02</div><h3>Pay safely</h3><p>Pay Muralla Tech by GCash or Maya and send your proof of payment. We check it before the seller hands anything over.</p></div>
      <div class="step"><div class="n">03</div><h3>Receive it</h3><p>Confirm when the item arrives and the seller gets paid. Prefer to meet up? Pay the seller directly at a safe spot.</p></div>
    </div>
  </section>

  <section class="wrap section">
    <div class="sell-band">
      <div><h2>Got gadgets to sell?</h2><p>List an item in minutes. We review it, you hand it over, and you get paid.</p></div>
      <a class="btn btn--primary btn--lg" href="${page('sell')}">${icon('plus', 16)} List an item</a>
    </div>
  </section>`;

  // ---- Newest devices: tabs swap the row of cards ----
  const row = document.querySelector('[data-newest]');
  const drawRow = (type) => {
    const list = byNewest(type);
    row.innerHTML = list.length ? h`${list.map(MF.card.render)}` : h`<div class="empty" style="flex:1;padding:30px 10px">Nothing here yet.</div>`;
    MF.card.initAll(row);
  };
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    drawRow(b.dataset.tab);
  }));
  drawRow('');

  document.querySelector('[data-hero-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q').toString().trim();
    location.href = page('browse') + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  // ---- hero carousel: auto-advances every 4 s, pauses on hover/focus, arrows, dots, swipe, arrow keys ----
  const el = document.querySelector('[data-carousel]');
  const n = newest.length;
  if (!n) {
    el.innerHTML = '<div class="hc-viewport"><div class="empty" style="margin:20px;padding:30px 10px">No listings yet.</div></div>';
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = h`
    <div class="hc-viewport" aria-live="off">
      ${newest.map((l, i) => h`<a class="hc-slide" href="${page('listing')}?id=${l.id}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}: ${l.title}">
        <img alt="" decoding="async" data-src="${url(l.photos[0])}"><span class="hc-caption"><span class="hc-title">${l.title}</span><b class="hc-price">${peso(l.price)}</b></span></a>`)}
      ${n > 1 ? h`<button type="button" class="hc-arrow hc-prev" aria-label="Previous listing">${icon('left')}</button>
      <button type="button" class="hc-arrow hc-next" aria-label="Next listing">${icon('right')}</button>` : ''}
    </div>
    ${n > 1 ? h`<div class="hc-dots" role="group" aria-label="Choose a listing">${newest.map((_, i) => h`<button type="button" class="hc-dot" aria-label="Show listing ${i + 1} of ${n}"></button>`)}</div>` : ''}`;

  const slides = Array.from(el.querySelectorAll('.hc-slide'));
  const dots = Array.from(el.querySelectorAll('.hc-dot'));
  const viewport = el.querySelector('.hc-viewport');
  let cur = 0, timer = null, paused = false, touchX = null;

  function load(i) { const img = slides[i % n].querySelector('img'); if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; } }
  function show(i) {
    cur = ((i % n) + n) % n;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === cur);
      s.setAttribute('aria-hidden', String(k !== cur));
      s.tabIndex = k === cur ? 0 : -1;
    });
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === cur)));
    load(cur); load(cur + 1);
    clearTimeout(timer);
    if (n > 1 && !reduced && !paused) timer = setTimeout(() => show(cur + 1), 4000);
    viewport.setAttribute('aria-live', n > 1 && !reduced && !paused ? 'off' : 'polite');
  }
  slides.forEach((s) => s.querySelector('img').addEventListener('error', function () { this.src = MF.root + 'assets/placeholder.svg'; }, { once: true }));
  el.addEventListener('mouseenter', () => { paused = true; show(cur); });
  el.addEventListener('mouseleave', () => { paused = false; show(cur); });
  el.addEventListener('focusin', () => { paused = true; clearTimeout(timer); });
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) { paused = false; show(cur); } });
  el.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1); else if (e.key === 'ArrowLeft') show(cur - 1); });
  const prev = el.querySelector('.hc-prev'), next = el.querySelector('.hc-next');
  if (prev) { prev.addEventListener('click', () => show(cur - 1)); next.addEventListener('click', () => show(cur + 1)); }
  dots.forEach((d, k) => d.addEventListener('click', () => show(k)));
  viewport.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
  });
  show(0);
});
