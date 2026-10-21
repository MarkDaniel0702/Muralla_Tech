/* Sell / create listing. Sellers submit for review; admins publish at once. Up to 5 photos (shrunk in the browser). */
MF.ui.boot(function () {
  const { h, icon, peso, page } = MF.ui;
  const app = document.getElementById('app');
  const user = MF.auth.require();   // any signed-in account; buyers get an upgrade offer below
  if (!user) return;

  const MAX = MF.listings.MAX_PHOTOS;
  const state = { photos: [], type: 'preloved', error: '', busy: false, done: null };
  const val = {}; // keeps typed values across redraws

  function gate() {
    app.innerHTML = h`<div class="wrap section"><div class="empty" style="max-width:520px;margin:30px auto">
      <h3>Want to sell on Muralla Tech?</h3><p>Your account is a buyer account. Upgrade to a seller account to list your electronics.</p>
      <button type="button" class="btn btn--primary" style="margin-top:14px" data-act="upgrade">Upgrade to Seller Account</button></div></div>`;
    MF.ui.wire(app, { upgrade: () => { MF.auth.update(user.id, { role: 'seller' }); location.reload(); } });
  }
  if (user.role === 'buyer') return gate();

  function success() {
    const published = state.done.status === 'approved';
    app.innerHTML = h`<div class="wrap section"><div class="confirmation">
      <div class="check">${icon('check', 36)}</div>
      <h2>${published ? 'Published' : 'Submitted for review'}</h2>
      <div class="ordernum">${published ? 'Your item is live' : 'Your item has been submitted'}</div>
      <p class="next">${published ? 'Buyers can find it in Browse right now.' : 'An admin reviews new listings before they go live. You can follow the status in My Listings.'}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button type="button" class="btn btn--primary" data-act="another">List another item</button>
        ${published ? h`<a class="btn btn--ghost" href="${page('listing')}?id=${state.done.id}">View listing</a>` : ''}
        <a class="btn btn--ghost" href="${page('orders')}?tab=listings">My listings</a></div></div></div>`;
  }

  function draw() {
    if (state.done) return success();
    const v = (k, d) => (val[k] != null ? val[k] : d || '');
    app.innerHTML = h`
    <div class="wrap section">
      <div class="breadcrumb"><a href="${page('index')}">Home</a><span class="sep">/</span><span>Sell an item</span></div>
      <h1 style="margin:6px 0 4px">List an item</h1>
      <p class="sub" style="margin-bottom:20px;color:var(--muted)">${user.role === 'admin' ? 'As an admin your listing is published immediately.' : 'Your listing goes live after an admin reviews it.'} Electronics only. No listing fee during the pilot.</p>
      ${state.error ? MF.ui.notice('error', state.error) : ''}
      <div class="sell-layout">
        <form class="co-panel" data-form="create" novalidate>
          <h2>Photos &amp; details</h2>
          <div class="field" style="margin-bottom:22px">
            <label for="sl-photos">Item photos (${state.photos.length}/${MAX})</label>
            <div class="dropzone" style="position:relative">
              ${icon('plus', 34)}<b>Choose product photos</b><span>Up to ${MAX} photos. The first one is the cover. They are shrunk to fit this browser's storage.</span>
              <input id="sl-photos" type="file" accept="image/*" multiple style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer" data-photos>
            </div>
            ${state.photos.length ? h`<div class="photo-grid">${state.photos.map((src, i) => h`<div class="ph${i === 0 ? ' cover' : ''}"><img src="${src}" alt="Photo ${i + 1}" style="width:100%;height:100%;object-fit:cover"><button type="button" data-act="rm-photo" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`)}</div>` : ''}
          </div>
          <div class="field"><label for="sl-title">Title *</label><input id="sl-title" name="title" value="${v('title')}" placeholder="e.g. Apple iPhone 12 128GB Black" required></div>
          <div class="field-row">
            <div class="field"><label for="sl-cat">Category *</label><select id="sl-cat" name="category" disabled><option>Electronics</option></select></div>
            <div class="field"><label for="sl-price">Price (₱) *</label><input id="sl-price" name="price" type="number" min="1" step="0.01" value="${v('price')}" placeholder="0" required></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="sl-brand">Brand *</label><input id="sl-brand" name="brand" maxlength="60" value="${v('brand')}" placeholder="e.g. Apple, or Unbranded" required></div>
            <div class="field"><label for="sl-mat">Material / Color *</label><input id="sl-mat" name="material_color" maxlength="60" value="${v('material_color')}" placeholder="e.g. Aluminum, black" required></div>
          </div>
          <div class="field"><label for="sl-size">Size / Dimensions *</label><input id="sl-size" name="size" maxlength="80" value="${v('size')}" placeholder="e.g. 146.7 x 71.5 x 7.4 mm (6.1-inch screen)" required></div>
          <div class="field"><label for="sl-desc">Description *</label><textarea id="sl-desc" name="description" rows="4" placeholder="Battery health, flaws, what is in the box, reason for selling…" required>${v('description')}</textarea></div>
          <div class="field-row">
            <div class="field"><label for="sl-cond">Condition *</label><select id="sl-cond" name="condition">${MF.listings.CONDITIONS.map((c) => h`<option${v('condition', 'Like New') === c ? ' selected' : ''}>${c}</option>`)}</select></div>
            <div class="field"><label for="sl-stock">Stock / Quantity</label><input id="sl-stock" name="stock" type="number" min="1" value="${v('stock', '1')}"></div>
          </div>
          <div class="field"><label for="sl-loc">Location</label><input id="sl-loc" name="location" value="${v('location')}" placeholder="e.g. Quezon City"></div>
          <h2 style="margin-top:26px">Item type</h2>
          <div class="segmented" role="radiogroup" aria-label="Item type" style="margin-bottom:14px">
            ${['preloved', 'surplus'].map((t) => h`<button type="button" role="radio" aria-checked="${String(state.type === t)}" class="${state.type === t ? 'on' : ''}" data-act="type" data-type="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`)}
          </div>
          <h2 style="margin-top:26px">Delivery</h2>
          <div class="checks-inline">
            <label><input type="checkbox" name="can_ship" ${val.can_ship === false ? '' : 'checked'}> Can ship / deliver</label>
            <label><input type="checkbox" name="can_meetup" ${val.can_meetup === false ? '' : 'checked'}> Can meet up</label>
          </div>
          <div class="co-actions" style="margin-top:34px"><a class="btn btn--ghost" href="${page('index')}">Cancel</a>
            <button type="submit" class="btn btn--primary" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Reading photos…' : user.role === 'admin' ? 'Publish listing' : 'Submit listing'}</button></div>
        </form>
        <aside><div class="sell-preview"><div class="lbl">Preview</div>
          <div class="pcard"><div class="pcard__media"><div class="pcard__badges"><span class="tag tag--${state.type}">${state.type}</span></div>
            <img src="${state.photos[0] || MF.root + 'assets/placeholder.svg'}" alt="${v('title') || 'Preview of your listing'}"></div>
            <div class="pcard__body"><h3 class="pcard__title" data-pv-title>${v('title') || 'Item title here'}</h3><div class="pcard__price"><span class="now" data-pv-price>${peso(v('price') || 0)}</span></div></div></div>
          <div class="sell-tips"><h4>Tips for selling fast</h4><ul><li>Be honest about battery health and flaws</li><li>Show the screen on and the ports</li><li>Say what is in the box</li><li>Price against similar items</li></ul></div>
        </div></aside>
      </div>
    </div>`;
  }

  // remember typed values so redraws (photo added, type switched) do not wipe the form
  const remember = () => {
    const f = app.querySelector('form');
    if (!f) return;
    ['title', 'price', 'brand', 'material_color', 'size', 'description', 'condition', 'stock', 'location'].forEach((k) => { val[k] = f.elements[k].value; });
    val.can_ship = f.elements.can_ship.checked;
    val.can_meetup = f.elements.can_meetup.checked;
  };

  app.addEventListener('input', (e) => {
    if (e.target.name === 'title') app.querySelector('[data-pv-title]').textContent = e.target.value || 'Item title here';
    if (e.target.name === 'price') app.querySelector('[data-pv-price]').textContent = peso(e.target.value || 0);
  });
  app.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-photos]')) return;
    remember();
    const files = Array.from(e.target.files || []);
    const room = Math.max(0, MAX - state.photos.length);
    state.error = files.length > room ? 'A listing can have at most ' + MAX + ' photos: added ' + room + ', skipped ' + (files.length - room) + '.' : '';
    state.busy = true; draw();
    try {
      for (const f of files.slice(0, room)) state.photos.push(await MF.ui.fileToDataUrl(f, 900, 0.8));
    } catch (err) { state.error = err.message; }
    state.busy = false; draw();
  });
  MF.ui.wire(app, {
    'rm-photo': (b) => { remember(); state.photos.splice(Number(b.dataset.i), 1); state.error = ''; draw(); },
    type: (b) => { remember(); state.type = b.dataset.type; draw(); app.querySelector('[data-act="type"][aria-checked="true"]').focus(); },
    another: () => { Object.keys(val).forEach((k) => delete val[k]); state.photos = []; state.done = null; state.error = ''; draw(); },
  }, {
    create: (f) => {
      remember();
      try {
        state.done = MF.listings.create(MF.auth.current(), Object.assign({}, val, { type: state.type, photos: state.photos.slice() }));
        draw();
        window.scrollTo({ top: 0 });
      } catch (e) { state.error = e.message; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    },
  });
  draw();
});
