/* Home: hero with search + carousel of the newest listings, Shop by Category (Electronics only), How it works. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page, raw } = MF.ui;
  const approved = MF.listings.approved();
  const newest = approved.filter((l) => l.photos && l.photos[0]).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);

  document.getElementById('app').innerHTML = h`
  <section class="hero" aria-labelledby="hero-title">
    <div class="sunburst"></div>
    <div class="wrap hero-inner">
      <div>
        <h1 id="hero-title"><span class="g">Palengke</span> meets <span class="o">premium</span>.</h1>
        <p class="lead">Discover preloved gadgets, surplus chargers and certified-fresh electronics from sellers all over Metro Manila.</p>
        <form class="searchbar" role="search" data-hero-search>
          <input type="search" name="q" aria-label="Search electronics" placeholder="What are you looking for?">
          <button type="submit" class="btn btn--primary" style="padding:.6rem 1.1rem">Search</button>
        </form>
        <div class="hero-chips">
          ${['iPhone', 'AirPods', 'Power bank', 'Nintendo'].map((q) => h`<a href="${page('browse')}?q=${encodeURIComponent(q)}" class="btn btn--ghost" style="padding:.4rem .85rem;font-size:.8rem;border-radius:999px;background:var(--card)">${q}</a>`)}
        </div>
        <div class="hero-stats">
          <div><b data-stat="total">${approved.length}</b><span>Items Listed</span></div>
          <div><b>100%</b><span>Metro Manila</span></div>
        </div>
      </div>
      <div class="hero-collage">
        <div class="hero-carousel" data-carousel aria-roledescription="carousel" aria-label="Latest listings"></div>
        <div class="float-tag"><div class="dot"></div> Safe meetup spots</div>
      </div>
    </div>
  </section>

  <section class="wrap section" aria-labelledby="cat-title">
    <div class="section-head"><h2 id="cat-title">Shop by Category</h2>
      <a href="${page('browse')}" class="link">See all ${icon('arrow', 16)}</a></div>
    <div class="cat-grid" style="grid-template-columns:minmax(0,320px)">
      <a class="cat-tile" href="${page('browse')}">
        <div class="ico">${icon('chip', 24)}</div>
        <b>Electronics</b>
        <span>${approved.length.toLocaleString()} ${approved.length === 1 ? 'item' : 'items'}</span>
      </a>
    </div>
  </section>

  <section class="wrap section" id="how">
    <div class="section-head"><h2>How it works</h2></div>
    <div class="steps">
      <div class="step"><div class="n">01</div><h3>Find it</h3><p>Search preloved and surplus electronics and filter by condition, brand and price. Save the ones you like.</p></div>
      <div class="step"><div class="n">02</div><h3>Pay safely</h3><p>Pay ManilaFinds by GCash or Maya and send your proof of payment. We check it before the seller hands anything over.</p></div>
      <div class="step"><div class="n">03</div><h3>Receive it</h3><p>Confirm when the item arrives and the seller gets paid. Prefer to meet up? Pay the seller directly at a safe spot.</p></div>
    </div>
  </section>`;

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
