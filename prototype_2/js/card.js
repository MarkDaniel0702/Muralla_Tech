/* Browse-grid listing card. With 2+ photos the slideshow plays only while the pointer is over the card (or it has
   keyboard focus): it jumps to the second photo at once, then steps every 1.2 s, and returns to the first photo when it
   stops. Touch screens have no hover, so they get swipe and tappable dots instead of autoplay. */
(function () {
  const MF = window.MF;
  const { h, icon, peso, url, page } = MF.ui;
  const STEP_MS = 1200;
  const SWIPE_PX = 40;

  function render(l) {
    const photos = (l.photos && l.photos.length ? l.photos : ['assets/placeholder.svg']).slice(0, MF.listings.MAX_PHOTOS);
    const seller = MF.auth.find(l.seller_id);
    const meta = [seller && seller.first_name, l.location].filter(Boolean).join(' · ');
    const multi = photos.length > 1;
    return h`<article class="pcard lcard${l.stock < 1 ? ' is-off' : ''}" data-id="${l.id}">
      <div class="lc-media${multi ? ' has-dots' : ''}">
        <div class="pcard__badges"><span class="tag tag--${l.type}">${l.type}</span></div>
        ${l.stock < 1 ? h`<span class="pcard__state">Sold out</span>` : ''}
        ${photos.map((src, i) => h`<div class="lc-slide${i === 0 ? ' is-active' : ''}"${multi && i > 0 ? ' aria-hidden="true"' : ''}>
          <img ${i === 0 ? h`src="${url(src)}"` : h`data-src="${url(src)}"`} alt="${multi ? l.title + ', photo ' + (i + 1) + ' of ' + photos.length : l.title}" decoding="async"${i === 0 ? '' : ' loading="lazy"'}></div>`)}
        ${multi ? h`
          <button type="button" class="lc-arrow lc-prev" aria-label="Previous photo">${icon('left', 18)}</button>
          <button type="button" class="lc-arrow lc-next" aria-label="Next photo">${icon('right', 18)}</button>
          <div class="lc-dots" role="group" aria-label="Choose a photo">${photos.map((_, i) => h`<button type="button" class="lc-dot" aria-label="Show photo ${i + 1} of ${photos.length}" aria-current="${String(i === 0)}"></button>`)}</div>` : ''}
      </div>
      <div class="pcard__body">
        <h3 class="pcard__title"><a class="lc-link" href="${page('listing')}?id=${l.id}">${l.title}</a></h3>
        <div class="pcard__meta">${meta}</div>
        <div class="pcard__price"><span class="now">${peso(l.price)}</span></div>
      </div>
    </article>`;
  }

  function init(card) {
    const media = card.querySelector('.lc-media');
    const slides = Array.from(card.querySelectorAll('.lc-slide'));
    const dots = Array.from(card.querySelectorAll('.lc-dot'));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = slides.length;
    let cur = 0, timer = null, hover = false, focus = false, manual = false, touchX = null;

    slides.forEach((s) => {
      const img = s.querySelector('img');
      const done = () => { img.classList.add('is-ready'); media.classList.add('is-loaded'); };
      img.addEventListener('load', done);
      img.addEventListener('error', () => { img.src = MF.root + 'assets/placeholder.svg'; media.classList.add('is-loaded'); }, { once: true });
      if (img.complete && img.naturalWidth) done();
    });
    if (n < 2) return;

    function go(i, byHand) {
      if (byHand) manual = true;
      cur = ((i % n) + n) % n;
      slides.forEach((s, k) => {
        const on = k === cur;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        const img = s.querySelector('img');
        if (on && img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
      });
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === cur)));
    }
    const engaged = () => hover || focus;
    function start() {
      if (timer || reduced) return;
      go(1);
      timer = setInterval(() => { if (!manual) go(cur + 1); }, STEP_MS);
    }
    function stop() {
      clearInterval(timer);
      timer = null;
      manual = false;
      go(0);
    }
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; hover = true; start(); });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; hover = false; if (!focus) stop(); });
    card.addEventListener('focusin', (e) => { if (!e.target.matches(':focus-visible')) return; focus = true; start(); });
    card.addEventListener('focusout', (e) => { if (card.contains(e.relatedTarget)) return; focus = false; if (!hover) stop(); });
    card.querySelector('.lc-prev').addEventListener('click', () => go(cur - 1, true));
    card.querySelector('.lc-next').addEventListener('click', () => go(cur + 1, true));
    dots.forEach((d, k) => d.addEventListener('click', () => go(k, true)));
    card.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; slides.forEach((s) => { const i = s.querySelector('img'); if (i.dataset.src) { i.src = i.dataset.src; delete i.dataset.src; } }); }, { passive: true });
    card.addEventListener('touchend', (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > SWIPE_PX) go(cur + (dx < 0 ? 1 : -1), true);
    });
  }

  const initAll = (root) => root.querySelectorAll('.lcard').forEach(init);

  MF.card = { render, initAll };
})();
