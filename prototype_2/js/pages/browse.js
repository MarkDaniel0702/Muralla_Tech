/* Browse: search, sort and filters (type, price, condition, brand, size, material/color). The URL is the single source of truth,
   so reload, back/forward and shared links keep the same results. */
MF.ui.boot(function () {
  const { h, page } = MF.ui;
  const PAGE_SIZE = 12;
  const KEYS = ['q', 'type', 'cond', 'min', 'max', 'brand', 'size', 'mat', 'seller', 'sort'];
  const app = document.getElementById('app');

  app.innerHTML = h`
  <div class="wrap section">
    <div class="breadcrumb"><a href="${page('index')}">Home</a><span class="sep">/</span><span data-heading>All Listings</span></div>
    <form class="searchbar browse-search" role="search" data-search style="margin-bottom:24px">
      <input type="search" name="q" aria-label="Search listings" placeholder="Search listings…"><button type="submit" class="btn btn--primary">Search</button>
    </form>
    <div class="browse-layout">
      <aside class="filter-rail" aria-label="Filters" data-rail></aside>
      <div>
        <div class="sort-bar">
          <div class="res" data-count aria-live="polite"></div>
          <button type="button" class="btn btn--ghost btn--sm mobile-filter-btn" data-act="open-rail">Filters</button>
          <select aria-label="Sort listings" data-sort>
            <option value="newest">Newest First</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option>
          </select>
        </div>
        <div data-results></div>
        <div data-pager></div>
      </div>
    </div>
  </div>`;

  const rail = app.querySelector('[data-rail]');
  const get = () => Object.fromEntries(KEYS.map((k) => [k, MF.ui.params().get(k) || '']));
  const pageNo = () => Math.max(1, parseInt(MF.ui.params().get('page') || '1', 10) || 1);

  function update(changes, rerenderRail) {
    const p = MF.ui.params();
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null ? p.delete(k) : p.set(k, v)));
    if (!('page' in changes)) p.delete('page');
    history.pushState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    if (rerenderRail) renderRail();
    renderResults();
  }

  function renderRail() {
    const f = get();
    const radios = (name, values, labelOf) => values.map((v) => h`<label class="check"><input type="radio" name="${name}" value="${v}" ${f[name] === v ? 'checked' : ''}> ${labelOf(v)}</label>`);
    rail.innerHTML = h`
      <div class="rail-head"><b>Filters</b><button type="button" class="btn btn--primary btn--sm" data-act="close-rail" data-rail-done>Done</button></div>
      <div class="fgroup"><h3>Type</h3>${radios('type', ['', 'preloved', 'surplus'], (t) => (t ? t[0].toUpperCase() + t.slice(1) : 'All'))}</div>
      <div class="fgroup"><h3>Price (₱)</h3>
        <div class="price-row"><input type="number" min="0" placeholder="Min" aria-label="Minimum price" name="min" value="${f.min}"> – <input type="number" min="0" placeholder="Max" aria-label="Maximum price" name="max" value="${f.max}"></div>
        <div class="price-bands">
          <button type="button" data-act="band" data-min="" data-max="2000">Under ₱2k</button>
          <button type="button" data-act="band" data-min="2000" data-max="10000">₱2k – ₱10k</button>
          <button type="button" data-act="band" data-min="10000" data-max="">Over ₱10k</button>
        </div>
      </div>
      <div class="fgroup"><h3>Condition</h3>${radios('cond', [''].concat(MF.listings.CONDITIONS), (c) => c || 'Any')}</div>
      ${[['Brand', 'brand'], ['Size', 'size'], ['Material / Color', 'mat']].map(([label, key]) => h`
        <div class="fgroup"><h3>${label}</h3><input type="text" name="${key}" maxlength="80" placeholder="Any ${label.toLowerCase()}" aria-label="Filter by ${label.toLowerCase()}" value="${f[key]}"></div>`)}
      <button type="button" class="btn btn--ghost btn--sm" data-act="clear" hidden>Clear all filters</button>`;
  }

  function renderResults() {
    const f = get();
    const all = MF.listings.search(f);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const p = Math.min(pageNo(), pages);
    const seller = f.seller && MF.auth.find(f.seller);
    const heading = seller ? 'Listings by ' + MF.ui.fullName(seller) : f.q ? 'Search: ' + f.q : 'All Listings';
    app.querySelector('[data-heading]').textContent = heading;
    document.title = heading + ' - Muralla Tech';
    app.querySelector('[data-search] input').value = f.q;
    const hs = document.querySelector('[data-header-search]');
    if (hs && !hs.matches(':focus')) hs.value = f.q;
    app.querySelector('[data-sort]').value = MF.listings.SORTS.includes(f.sort) ? f.sort : 'newest';
    app.querySelector('[data-count]').innerHTML = h`<b>${total}</b> ${total === 1 ? 'result' : 'results'} found`;
    app.querySelector('[data-rail-done]').textContent = 'Show ' + total + ' results';
    const hasFilters = Object.keys(f).some((k) => k !== 'sort' && f[k]);
    rail.querySelector('[data-act=clear]').hidden = !hasFilters;

    const box = app.querySelector('[data-results]');
    if (!total) {
      box.innerHTML = h`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <h3>No results found</h3><p>${hasFilters ? 'Try adjusting your search or filters.' : 'No listings have been published yet. Check back soon!'}</p></div>`;
    } else {
      box.innerHTML = h`${seller ? h`<p class="order-meta" style="margin-bottom:14px">Showing only ${MF.ui.fullName(seller)}'s items. <a href="${page('browse')}" style="color:var(--palm);font-weight:700">Show everything</a></p>` : ''}<div class="card-grid">${all.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(MF.card.render)}</div>`;
      MF.card.initAll(box);
    }
    app.querySelector('[data-pager]').innerHTML = pages > 1 ? h`<nav class="pagination-simple" aria-label="Pages" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:32px">
      ${p > 1 ? h`<button type="button" class="btn btn--ghost btn--sm" data-act="page" data-page="${p - 1}">← Prev</button>` : ''}
      <span style="font-size:.88rem;color:var(--muted)">Page ${p} of ${pages}</span>
      ${p < pages ? h`<button type="button" class="btn btn--ghost btn--sm" data-act="page" data-page="${p + 1}">Next →</button>` : ''}</nav>` : '';
  }

  MF.ui.wire(app, {
    'open-rail': () => rail.classList.add('open'),
    'close-rail': () => rail.classList.remove('open'),
    band: (b) => update({ min: b.dataset.min, max: b.dataset.max }, true),
    clear: () => update(Object.fromEntries(KEYS.map((k) => [k, ''])), true),
    page: (b) => { const p = MF.ui.params(); p.set('page', b.dataset.page); history.pushState(null, '', location.pathname + '?' + p); renderResults(); window.scrollTo({ top: 0 }); },
  }, { search: (f) => update({ q: new FormData(f).get('q').toString().trim() }, true) });

  // filters: radios apply at once; text and number fields apply when you leave them or press Enter
  rail.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'radio') update({ [t.name]: t.value });
    else update({ [t.name]: t.value.trim() });
  });
  rail.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[type=text],input[type=number]')) e.target.blur(); });
  app.querySelector('[data-sort]').addEventListener('change', (e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value }));
  window.addEventListener('popstate', () => { renderRail(); renderResults(); });

  renderRail();
  renderResults();
});
