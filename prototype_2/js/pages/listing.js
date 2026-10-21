/* Listing detail: gallery, specs, stock, quantity, add to cart, save, seller card, photo credits. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page } = MF.ui;
  const app = document.getElementById('app');
  const id = MF.ui.params().get('id');
  const l = MF.listings.byId(id);
  const user = MF.auth.current();
  const seller = l && MF.auth.find(l.seller_id);
  const canSee = l && (l.status === 'approved' || (user && (user.role === 'admin' || user.id === l.seller_id)));

  if (!canSee) {
    app.innerHTML = h`<div class="wrap section"><div class="empty"><h3>Listing not found</h3><p>This listing may have been removed or is pending approval.</p>
      <a href="${page('browse')}" class="btn btn--primary" style="margin-top:14px">Browse All Listings</a></div></div>`;
    document.title = 'Listing not found - ManilaFinds';
    return;
  }
  document.title = l.title + ' - ManilaFinds';

  const photos = l.photos && l.photos.length ? l.photos : ['assets/placeholder.svg'];
  const isOwn = !!user && user.id === l.seller_id;
  const sellerName = MF.ui.fullName(seller, 'Seller');
  let photoIdx = 0, qty = 1;

  const spec = (ic, label, value) => (value ? h`<div class="spec"><div class="si">${icon(ic, 17)}</div><div><small>${label}</small><b>${value}</b></div></div>` : '');
  const stockBadge = () => h`<div class="stock-badge ${l.stock > 0 ? 'in' : 'out'}"><span aria-hidden="true"></span>${l.stock > 0 ? l.stock + ' in stock' : 'Out of stock'}</div>`;

  function draw() {
    const buyLabel = isOwn ? 'This is your listing' : l.status !== 'approved' ? 'Not published yet' : l.stock > 0 ? h`${icon('bag', 18)} Add to cart` : 'Out of stock';
    app.innerHTML = h`
    <div class="wrap pdp section">
      <div class="gallery">
        <div class="main"><img src="${url(photos[photoIdx])}" alt="${photos.length > 1 ? l.title + ', photo ' + (photoIdx + 1) + ' of ' + photos.length : l.title}"></div>
        ${photos.length > 1 ? h`<div class="thumbs">${photos.map((src, i) => h`<button type="button" class="${i === photoIdx ? 'on' : ''}" data-act="photo" data-i="${i}" aria-label="Show photo ${i + 1} of ${photos.length}" aria-pressed="${String(i === photoIdx)}"><img src="${url(src)}" alt=""></button>`)}</div>` : ''}
        ${l.photo_credits && l.photo_credits.length ? h`<details class="photo-credits"><summary>Photo credits</summary>
          <p>Demo photos from Wikimedia Commons, shown under their licenses. They show this model, not this exact unit.</p>
          <ul>${l.photo_credits.map((c, i) => h`<li>Photo ${i + 1} (${c.angle}): ${c.credit}, ${c.license}. <a href="${c.source_url}" target="_blank" rel="noopener noreferrer">Source</a></li>`)}</ul></details>` : ''}
      </div>

      <div class="pdp-info">
        <div class="breadcrumb"><a href="${page('index')}">Home</a><span class="sep">/</span><a href="${page('browse')}">Browse</a><span class="sep">/</span><span>${l.title}</span></div>
        ${l.status !== 'approved' ? MF.ui.notice('error', 'This listing is ' + l.status + (l.admin_note ? ': ' + l.admin_note : ' and not visible to buyers yet') + '.') : ''}
        <div class="pdp-meta-top"><span class="tag tag--${l.type}">${l.type}</span><span class="pill pill--muted">${l.condition}</span></div>
        <h1>${l.title}</h1>
        <div class="price-block"><span class="now tnum">${peso(l.price)}</span></div>
        <p class="pdp-desc">${l.description}</p>
        ${stockBadge()}
        <div class="spec-grid">
          ${spec('pin', 'Location', l.location)}${spec('tag', 'Category', l.category)}${spec('spec', 'Brand', l.brand)}${spec('spec', 'Size', l.size)}${spec('spec', 'Material / Color', l.material_color)}
          ${l.can_ship ? spec('truck', 'Delivery', 'Ships nationwide') : ''}${l.can_meetup ? spec('users', 'Meetup', 'Available') : ''}
        </div>
        <div class="buy-row">
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-act="qty-" aria-label="Decrease quantity">–</button><span aria-live="polite">${qty}</span><button type="button" data-act="qty+" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn--primary btn--lg" data-act="add" ${l.stock < 1 || isOwn || l.status !== 'approved' ? 'disabled' : ''}>${buyLabel}</button>
          <button type="button" class="icon-btn" style="border:1.5px solid var(--line-strong);width:46px;height:46px;color:${MF.listings.isSaved(l.id) ? 'var(--danger)' : 'currentColor'}" data-act="save"
            aria-label="${MF.listings.isSaved(l.id) ? 'Remove from saved' : 'Save item'}" aria-pressed="${String(MF.listings.isSaved(l.id))}">${icon('heart', 20)}</button>
        </div>
        <div data-added></div>
        <div class="seller-card">
          <div class="row"><div class="av">${sellerName[0].toUpperCase()}</div>
            <div><div class="nm">${sellerName} <span class="verified">${icon('check', 14)} Verified</span></div>
              ${seller ? h`<div class="sub">Member since ${new Date(seller.created_at).getFullYear()}</div>` : ''}</div></div>
          <a class="btn btn--ghost btn--block" style="margin-top:14px;text-align:center" href="${page('browse')}?seller=${l.seller_id}">View seller's items</a>
        </div>
      </div>
    </div>`;
    const heart = app.querySelector('[data-act="save"] svg');
    if (MF.listings.isSaved(l.id)) heart.setAttribute('fill', 'currentColor');
  }

  MF.ui.wire(app, {
    photo: (b) => { photoIdx = Number(b.dataset.i); draw(); app.querySelector('.thumbs button.on').focus(); },
    'qty-': () => { qty = Math.max(1, qty - 1); draw(); app.querySelector('[data-act="qty-"]').focus(); },
    'qty+': () => { qty = Math.min(Math.max(1, l.stock), qty + 1); draw(); app.querySelector('[data-act="qty+"]').focus(); },
    save: () => { const now = MF.listings.toggleSaved(l.id); draw(); app.querySelector('[data-act="save"]').focus(); MF.ui.toast(now ? 'Saved to your favorites.' : 'Removed from favorites.'); },
    add: () => {
      if (!MF.auth.current()) { location.href = page('login') + '?next=' + encodeURIComponent(MF.ui.here()); return; }
      try {
        MF.cart.add(l.id, qty);
      } catch (e) { MF.ui.toast(e.message, true); return; }
      MF.ui.mountShell(); // refresh the cart badge
      app.querySelector('[data-added]').innerHTML = h`<div class="notice notice--ok" role="status"><span>${icon('check', 15)} Item added to your cart</span><a href="${page('cart')}" style="font-weight:700;text-decoration:underline">View cart →</a></div>`;
    },
  });
  draw();
});
