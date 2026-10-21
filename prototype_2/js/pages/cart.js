/* Cart page: items grouped by seller, quantity, remove, totals. Login required. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page } = MF.ui;
  const app = document.getElementById('app');
  if (!MF.auth.require()) return;

  function draw() {
    const { lines, issues } = MF.cart.resolve();
    const t = MF.cart.totals(lines, 'standard');
    const groups = {};
    lines.forEach((x) => (groups[x.listing.seller_id] = groups[x.listing.seller_id] || []).push(x));
    const note = issues.length ? h`<div class="notice notice--stack" role="status"><b>Your cart was updated:</b>${issues.map((i) => h`<div>${i}</div>`)}</div>` : '';

    if (!lines.length) {
      app.innerHTML = h`<div class="wrap section"><h1>Your Cart</h1>${note}
        <div class="empty" style="max-width:420px;margin:40px auto">${icon('bag', 52)}<h3>Your cart is empty</h3><p>Add something you like and it will show up here.</p>
        <a class="btn btn--primary" style="margin-top:14px" href="${page('browse')}">Browse listings</a></div></div>`;
      return;
    }
    app.innerHTML = h`<div class="wrap section"><h1>Your Cart</h1>${note}
      <div class="cart-layout">
        <div>${Object.keys(groups).map((sid) => {
          const s = MF.auth.find(sid);
          const name = MF.ui.fullName(s, 'Seller');
          return h`<div class="cart-seller"><div class="cart-seller__head"><div class="av">${name[0].toUpperCase()}</div><span>${name}</span></div>
            ${groups[sid].map(({ listing: l, qty }) => h`<div class="cart-row">
              <div class="thumb"><img src="${url(MF.listings.photoOf(l))}" alt="${l.title}"></div>
              <div><div class="ci-title"><a href="${page('listing')}?id=${l.id}">${l.title}</a></div>
                <div class="ci-meta">${l.type === 'surplus' ? 'Surplus' : 'Preloved'} &middot; ${l.condition}</div>
                <div class="ci-unit">${peso(l.price)} each</div></div>
              <div class="ci-right"><div class="ci-total">${peso(l.price * qty)}</div>
                <div class="qty qty--sm" role="group" aria-label="Quantity for ${l.title}">
                  <button type="button" data-act="dec" data-id="${l.id}" aria-label="Decrease quantity">–</button><span>${qty}</span>
                  <button type="button" data-act="inc" data-id="${l.id}" aria-label="Increase quantity" ${qty >= l.stock ? 'disabled' : ''}>+</button></div>
                <button type="button" class="rm" data-act="rm" data-id="${l.id}">${icon('trash', 14)} Remove</button></div></div>`)}</div>`;
        })}</div>
        <aside><div class="summary"><h3>Order Summary</h3>
          <div class="line"><span>Subtotal (${t.items} ${t.items === 1 ? 'item' : 'items'})</span><span>${peso(t.subtotal)}</span></div>
          <div class="line"><span>Delivery estimate${t.sellers > 1 ? ' (' + t.sellers + ' sellers)' : ''}</span><span>${peso(t.delivery)}</span></div>
          <div class="line total"><span>Total</span><span class="tnum">${peso(t.total)}</span></div>
          <a class="btn btn--primary btn--block btn--lg" style="margin-top:20px" href="${page('checkout')}">Proceed to checkout</a>
          <p class="fineprint">You choose delivery or meet-up next. Pay by GCash or Maya through ManilaFinds; meet-up payments are arranged with the seller.</p>
        </div></aside>
      </div></div>`;
  }

  const qtyOf = (id) => (MF.cart.read().find((i) => i.id === id) || { qty: 0 }).qty;
  MF.ui.wire(app, {
    inc: (b) => { MF.cart.setQty(b.dataset.id, qtyOf(b.dataset.id) + 1); draw(); MF.ui.mountShell(); },
    dec: (b) => { MF.cart.setQty(b.dataset.id, qtyOf(b.dataset.id) - 1); draw(); MF.ui.mountShell(); },
    rm: (b) => { MF.cart.remove(b.dataset.id); draw(); MF.ui.mountShell(); },
  });
  draw();
});
