/* Checkout: 1 Delivery & details, 2 Payment method, 3 Review. One order is created per seller. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page, methodLabel } = MF.ui;
  const app = document.getElementById('app');
  const user = MF.auth.require();
  if (!user) return;

  const settings = MF.db.settings();
  const accounts = settings.platform_accounts || {};
  const active = (m) => !!(accounts[m] && accounts[m].active);
  const s = { step: 1, delivery: 'standard', method: active('gcash') ? 'gcash' : active('maya') ? 'maya' : '', first_name: user.first_name, last_name: user.last_name, phone: '', address: '', notes: '', error: '', placing: false, placed: null };
  const resolved = MF.cart.resolve();
  const issues = resolved.issues;

  function totals() { return MF.cart.totals(resolved.lines, s.delivery); }

  function confirmation() {
    const many = s.placed.length > 1;
    const digital = MF.pay.isDigital(s.placed[0]);
    return h`<div class="wrap section"><div class="confirmation">
      <div class="check">${icon('check', 36)}</div>
      <h2>${many ? 'Orders placed' : 'Order placed'}</h2>
      <div class="order-list">${s.placed.map((o) => h`<div><span class="ordernum">${o.order_number}</span><span>${MF.ui.fullName(MF.auth.find(o.seller_id))} · <b>${peso(o.total)}</b></span></div>`)}</div>
      ${digital ? h`
        <p class="next"><b>Next: pay with ${methodLabel(s.placed[0].payment_method)}.</b> Send the exact amount to ManilaFinds, then submit your proof of payment${many ? ' for each order (one payment per seller).' : '.'} The seller hands over the item once we confirm your payment.</p>
        <div class="pay-actions" style="margin-bottom:18px">${s.placed.map((o) => h`<a class="btn btn--primary" href="${page('pay')}?id=${o.id}">Pay ${peso(o.total)}${many ? ' for ' + o.order_number : ' now'}</a>`)}</div>` : h`
        <p class="next">${many ? 'Each order was saved and sent to its seller.' : 'Your order was saved and sent to the seller.'} They will confirm it, and you can follow the status under My Orders.</p>
        <p class="next"><b>Payment:</b> arranged directly between you and the seller at the meet-up. ManilaFinds does not handle this payment.</p>`}
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn ${digital ? 'btn--ghost' : 'btn--primary'}" href="${page('orders')}?tab=orders">View my orders</a>
        <a class="btn btn--ghost" href="${page('browse')}">Keep shopping</a></div></div></div>`;
  }

  function stepPanel(t) {
    const meetup = s.delivery === 'meetup';
    if (s.step === 1) {
      return h`<h2>Delivery method</h2>
        <label class="opt-card ${!meetup ? 'on' : ''}"><input type="radio" name="delivery" value="standard" ${!meetup ? 'checked' : ''}>
          <div class="oc-main"><div class="oc-title">Standard delivery</div><div class="oc-sub">2-3 days within Metro Manila · ${peso(settings.delivery_fee)} per seller</div></div><div class="oc-amt">${peso(settings.delivery_fee)}</div></label>
        <label class="opt-card ${meetup ? 'on' : ''}"><input type="radio" name="delivery" value="meetup" ${meetup ? 'checked' : ''}>
          <div class="oc-main"><div class="oc-title">Meet-up</div><div class="oc-sub">Buyer and seller arrange a safe location and pay each other directly</div></div><div class="oc-amt">Free</div></label>
        <h2 style="margin-top:24px">${meetup ? 'Your details' : 'Shipping address'}</h2>
        ${s.error ? MF.ui.notice('error', s.error) : ''}
        <div class="field-row">
          <div class="field"><label for="co-first">First name</label><input id="co-first" data-k="first_name" value="${s.first_name}" autocomplete="given-name"></div>
          <div class="field"><label for="co-last">Last name</label><input id="co-last" data-k="last_name" value="${s.last_name}" autocomplete="family-name"></div>
        </div>
        <div class="field"><label for="co-phone">Mobile number</label><input id="co-phone" data-k="phone" type="tel" inputmode="tel" placeholder="0917 123 4567" value="${s.phone}" autocomplete="tel"></div>
        ${!meetup ? h`<div class="field"><label for="co-address">Address</label><input id="co-address" data-k="address" placeholder="House no., street, barangay, city" value="${s.address}" autocomplete="street-address"></div>` : ''}
        <div class="field"><label for="co-notes">Note for the seller (optional)</label><input id="co-notes" data-k="notes" maxlength="300" placeholder="${meetup ? 'Preferred meet-up place and time' : 'Landmarks, best time to deliver'}" value="${s.notes}"></div>
        <div class="co-actions"><div></div><button type="button" class="btn btn--primary" data-act="to-payment">Continue to payment</button></div>`;
    }
    if (s.step === 2) {
      return h`<h2>Payment</h2>
        ${meetup ? h`<div class="co-note" role="note"><b>Payment for a meet-up is arranged directly between you and the seller.</b> ManilaFinds does not handle this payment, so there is nothing to pay here: no proof of payment, no fee, no payout.</div>` : h`
          <div class="pay-methods" role="radiogroup" aria-label="Payment method">
            ${['gcash', 'maya'].map((m) => h`<label class="opt-card ${s.method === m ? 'on' : ''} ${active(m) ? '' : 'is-off'}">
              <input type="radio" name="payment" value="${m}" ${s.method === m ? 'checked' : ''} ${active(m) ? '' : 'disabled'}>
              <div class="oc-main"><div class="oc-title">${methodLabel(m)}</div><div class="oc-sub">Pay ManilaFinds first, then send us your proof of payment. The seller is paid after you receive the item.</div></div>
              ${active(m) ? '' : h`<span class="pill pill--muted">Not available</span>`}</label>`)}
          </div>
          ${s.method ? h`<div class="co-note"><b>You pay ManilaFinds, not the seller.</b> After you place the order we show our ${methodLabel(s.method)} details and the exact amount. Send it, then submit the reference number. We hold the money and pay the seller after you confirm you received the item.</div>`
            : MF.ui.notice('error', 'Online payments are not available right now. Go back and choose a meet-up instead.')}`}
        <div class="co-actions"><button type="button" class="btn btn--ghost" data-act="to" data-step="1">Back</button>
          <button type="button" class="btn btn--primary" data-act="to" data-step="3" ${!meetup && !s.method ? 'disabled' : ''}>Review order</button></div>`;
    }
    return h`<h2>Review your order</h2>
      <div class="review-block"><h4>${meetup ? 'Meet-up for' : 'Shipping to'} <button type="button" class="linkbtn" data-act="to" data-step="1">Edit</button></h4>
        <div>${s.first_name.trim()} ${s.last_name.trim()} · ${s.phone.trim()}<br>${meetup ? 'Location arranged with the seller' : s.address.trim()}${s.notes.trim() ? h`<br>Note: ${s.notes.trim()}` : ''}</div></div>
      <div class="review-block"><h4>Payment <button type="button" class="linkbtn" data-act="to" data-step="2">Edit</button></h4>
        <div>${meetup ? 'Arranged directly between you and the seller at the meet-up.' : methodLabel(s.method) + ': you pay ' + peso(t.total) + ' to ManilaFinds' + (t.sellers > 1 ? ', one payment per seller (' + t.sellers + ')' : '') + ', and send proof after placing the order.'}</div></div>
      ${t.sellers > 1 ? h`<div class="co-note">Your cart has items from ${t.sellers} sellers, so this places ${t.sellers} separate orders, one per seller.</div>` : ''}
      ${s.error ? MF.ui.notice('error', s.error) : ''}
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-act="to" data-step="2">Back</button>
        <button type="button" class="btn btn--primary" data-act="place" ${s.placing ? 'disabled' : ''}>Place order</button></div>`;
  }

  function draw() {
    if (s.placed) { app.innerHTML = confirmation(); window.scrollTo({ top: 0 }); return; }
    if (!resolved.lines.length) {
      app.innerHTML = h`<div class="wrap section"><h1>Checkout</h1>
        ${issues.length ? h`<div class="notice notice--stack" role="status">${issues.map((i) => h`<div>${i}</div>`)}</div>` : ''}
        <div class="empty" style="max-width:420px;margin:40px auto"><h3>Your cart is empty</h3><p>Add an item to your cart before checking out.</p>
        <a class="btn btn--primary" style="margin-top:14px" href="${page('browse')}">Browse listings</a></div></div>`;
      return;
    }
    const t = totals();
    const meetup = s.delivery === 'meetup';
    const st = (n) => (s.step > n ? 'done' : s.step === n ? 'on' : '');
    app.innerHTML = h`<div class="wrap section"><h1>Checkout</h1>
      ${issues.length ? h`<div class="notice notice--stack" role="status"><b>Your cart was updated:</b>${issues.map((i) => h`<div>${i}</div>`)}</div>` : ''}
      <div class="checkout-layout"><div>
        <ol class="stepper" style="list-style:none;padding:0" aria-label="Checkout steps">
          <li class="st ${st(1)}"${s.step === 1 ? ' aria-current="step"' : ''}><div class="num">1</div> Delivery</li>
          <li class="st ${st(2)}"${s.step === 2 ? ' aria-current="step"' : ''}><div class="num">2</div> Payment</li>
          <li class="st ${st(3)}"${s.step === 3 ? ' aria-current="step"' : ''}><div class="num">3</div> Review</li></ol>
        <div class="co-panel" data-panel>${stepPanel(t)}</div>
      </div>
      <aside><div class="summary"><h3>Order Summary</h3>
        ${resolved.lines.map(({ listing: l, qty }) => h`<div class="mini-item"><div class="mi-thumb"><img src="${url(MF.listings.photoOf(l))}" alt=""></div><div>${l.title}</div><div class="mi-qty">x${qty}</div></div>`)}
        <div class="line" style="margin-top:16px"><span>Subtotal (${t.items} ${t.items === 1 ? 'item' : 'items'})</span><span>${peso(t.subtotal)}</span></div>
        <div class="line"><span>Delivery${!meetup && t.sellers > 1 ? ' (' + t.sellers + ' sellers)' : ''}</span><span>${t.delivery === 0 ? 'Free' : peso(t.delivery)}</span></div>
        <div class="line total"><span>${meetup ? 'Total to pay the seller' : 'Total to pay ManilaFinds'}</span><span class="tnum">${peso(t.total)}</span></div>
      </div></aside></div></div>`;
  }

  // text fields update state without redrawing, so typing is never interrupted
  app.addEventListener('input', (e) => { if (e.target.dataset.k) s[e.target.dataset.k] = e.target.value; });
  app.addEventListener('change', (e) => {
    if (e.target.name === 'delivery') { s.delivery = e.target.value; s.error = ''; draw(); app.querySelector('input[name=delivery]:checked').focus(); }
    if (e.target.name === 'payment') { s.method = e.target.value; draw(); app.querySelector('input[name=payment]:checked').focus(); }
  });
  MF.ui.wire(app, {
    'to-payment': () => {
      const digits = s.phone.replace(/\D/g, '');
      if (!s.first_name.trim() || !s.last_name.trim()) s.error = 'Please enter your first and last name.';
      else if (digits.length < 7 || digits.length > 15) s.error = 'Please enter a phone number the seller can reach you on.';
      else if (s.delivery === 'standard' && !s.address.trim()) s.error = 'Please enter your delivery address.';
      else { s.error = ''; s.step = 2; }
      draw();
    },
    to: (b) => { s.step = Number(b.dataset.step); s.error = ''; draw(); },
    place: () => {
      if (s.placing) return;
      s.placing = true;
      try {
        s.placed = MF.pay.placeOrder(MF.auth.current(), resolved.lines, { delivery: s.delivery, method: s.method, first_name: s.first_name, last_name: s.last_name, phone: s.phone, address: s.address, notes: s.notes });
        MF.cart.clear();
        MF.ui.mountShell();
      } catch (e) { s.error = e.message; }
      s.placing = false;
      draw();
    },
  });
  draw();
});
