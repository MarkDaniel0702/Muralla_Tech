/* Pay page (buyer): shows ManilaFinds' GCash / Maya details and the exact amount, then takes the proof of payment.
   The amount, reference rules and attempt limit are checked again in MF.pay.submitProof. */
MF.ui.boot(function () {
  const { h, peso, url, page, methodLabel, dateTime } = MF.ui;
  const app = document.getElementById('app');
  const user = MF.auth.require();
  if (!user) return;

  const id = MF.ui.params().get('id');
  const settings = MF.db.settings();
  const accounts = Object.keys(settings.platform_accounts).filter((m) => settings.platform_accounts[m].active);
  const s = { method: '', shot: '', shotError: '', error: '' };
  const PROOF_PILL = { pending: ['Under review', 'pill--warn'], approved: ['Approved', 'pill--ok'], rejected: ['Rejected', 'pill--danger'] };
  const fmtNumber = (n) => String(n).replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3');

  function draw() {
    const o = MF.pay.byId(id);
    if (!o || o.buyer_id !== user.id || !MF.pay.isDigital(o)) {
      app.innerHTML = h`<div class="wrap section"><div class="empty" style="max-width:440px;margin:40px auto">
        <h3>${o && o.buyer_id === user.id ? 'Nothing to pay here' : 'Order not found'}</h3>
        <p>${o && o.buyer_id === user.id ? 'This order is paid to the seller directly at the meet-up.' : 'This order does not exist or is not yours to pay.'}</p>
        <a class="btn btn--primary" style="margin-top:14px" href="${page('orders')}?tab=orders">My orders</a></div></div>`;
      return;
    }
    document.title = 'Pay ' + o.order_number + ' - ManilaFinds';
    const proofs = MF.pay.proofsOf(o.id).sort((a, b) => b.attempt - a.attempt);
    const left = settings.max_proof_attempts - proofs.length;
    const latest = proofs[0];
    const canSubmit = ['awaiting_payment', 'payment_rejected'].includes(o.status) && left > 0;
    const chosen = s.method || (accounts.includes(o.payment_method) ? o.payment_method : accounts[0] || '');
    const acct = settings.platform_accounts[chosen];

    app.innerHTML = h`<div class="wrap section">
      <div class="breadcrumb"><a href="${page('orders')}?tab=orders">My Orders</a><span class="sep">/</span><span>${o.order_number}</span></div>
      <div class="pay-head"><h1>Pay for order ${o.order_number}</h1>${MF.ui.statusPill(o.status)}</div>
      ${o.status === 'payment_submitted' ? MF.ui.notice('ok', h`<b>Proof received.</b> We are checking our ${methodLabel(latest && latest.method)} account. You will get a notification once it is approved.`) : ''}
      ${o.status === 'payment_rejected' && latest ? MF.ui.notice('error', h`<b>Your last proof was not approved:</b> ${latest.reject_reason}. ${left > 0 ? 'Please check the details and send corrected proof (' + left + ' attempt' + (left === 1 ? '' : 's') + ' left).' : 'No attempts are left. Please contact ManilaFinds support.'}`) : ''}
      ${o.status === 'payment_confirmed' ? MF.ui.notice('ok', h`<b>Payment approved.</b> ${o.handed_over_at ? 'The seller handed over your item.' : 'The seller will hand over your item.'} Confirm in <a href="${page('orders')}?tab=orders" style="text-decoration:underline">My Orders</a> once you have it.`) : ''}
      ${o.status === 'completed' ? MF.ui.notice('ok', 'Paid and received. Thank you!') : ''}
      ${o.status === 'cancelled' ? MF.ui.notice('error', 'This order was cancelled, so there is nothing to pay.') : ''}
      <div class="pay-layout">
        <div>
          ${canSubmit ? h`
          <section class="co-panel pay-details" aria-labelledby="pay-1">
            <h2 id="pay-1">1. Send ${peso(o.total)} to ManilaFinds</h2>
            ${!accounts.length ? MF.ui.notice('error', 'Online payments are not available right now. Please try again later or contact ManilaFinds support.') : h`
              ${accounts.length > 1 ? h`<div class="segmented" role="radiogroup" aria-label="Pay with" style="margin-bottom:14px">${accounts.map((m) => h`<button type="button" role="radio" aria-checked="${String(chosen === m)}" class="${chosen === m ? 'on' : ''}" data-act="method" data-m="${m}">${methodLabel(m)}</button>`)}</div>` : ''}
              <div class="pay-account">
                ${acct.qr ? h`<img class="pay-qr" src="${acct.qr}" alt="ManilaFinds ${methodLabel(chosen)} QR code">` : ''}
                <dl class="pay-facts">
                  <div><dt>${methodLabel(chosen)} account name</dt><dd><b>${acct.account_name}</b></dd></div>
                  <div><dt>${methodLabel(chosen)} number</dt><dd><b class="tnum">${fmtNumber(acct.account_number)}</b> <button type="button" class="btn btn--ghost btn--sm" data-act="copy" data-n="${acct.account_number}">Copy</button></dd></div>
                  <div><dt>Exact amount</dt><dd><b class="pay-amount">${peso(o.total)}</b></dd></div>
                  <div><dt>Message / note</dt><dd>${o.order_number}</dd></div>
                </dl>
              </div>
              <p class="order-meta">Demo only: no real money moves. Send the exact amount in one transfer and put the order number in the message. Keep your receipt: you need its reference number below.</p>`}
          </section>
          ${accounts.length ? h`
          <form class="co-panel" data-form="proof" novalidate aria-labelledby="pay-2">
            <h2 id="pay-2">2. Submit your proof of payment</h2>
            ${s.error ? MF.ui.notice('error', s.error) : ''}
            <div class="field-row">
              <div class="field"><label for="pp-sender">Sender name *</label><input id="pp-sender" name="sender" maxlength="80" autocomplete="name" placeholder="Name on your GCash / Maya account" required></div>
              <div class="field"><label for="pp-method">Paid with *</label><select id="pp-method" name="method">${accounts.map((m) => h`<option value="${m}"${m === chosen ? ' selected' : ''}>${methodLabel(m)}</option>`)}</select></div>
            </div>
            <div class="field-row">
              <div class="field"><label for="pp-ref">Reference number *</label><input id="pp-ref" name="reference" maxlength="40" autocomplete="off" placeholder="From your receipt, e.g. 1009 876 543 21" required></div>
              <div class="field"><label for="pp-amount">Amount sent (₱) *</label><input id="pp-amount" name="amount" type="number" inputmode="decimal" min="1" step="0.01" placeholder="${o.total}" required></div>
            </div>
            <div class="field"><label for="pp-shot">Screenshot of the receipt (optional)</label><input id="pp-shot" type="file" accept="image/*" data-shot>
              ${s.shot ? h`<img class="pay-shot-preview" src="${s.shot}" alt="Receipt screenshot preview">` : ''}
              ${s.shotError ? h`<div class="order-meta" style="color:var(--danger)">${s.shotError}</div>` : ''}</div>
            <p class="order-meta">Attempt ${proofs.length + 1} of ${settings.max_proof_attempts}. Each reference number can be used once. Only submit after the money has been sent.</p>
            <button type="submit" class="btn btn--primary">Submit proof of payment</button>
          </form>` : ''}` : ''}
          ${proofs.length ? h`<section class="co-panel"><h2>Your submissions</h2>
            ${proofs.map((p) => h`<div class="proof-row"><div><b>Attempt ${p.attempt}</b> · ${methodLabel(p.method)} · ref <code>${p.reference}</code> · ${peso(p.amount)}
              <div class="order-meta">Sent ${dateTime(p.submitted_at)} by ${p.sender_name}</div>
              ${p.reject_reason ? h`<div class="order-meta" style="color:var(--danger)">Reason: ${p.reject_reason}</div>` : ''}</div>
              <span class="pill ${PROOF_PILL[p.status][1]}">${PROOF_PILL[p.status][0]}</span></div>`)}</section>` : ''}
        </div>
        <aside><div class="summary"><h3>Order ${o.order_number}</h3>
          ${o.items.map((i) => h`<div class="mini-item"><div class="mi-thumb"><img src="${url(i.image)}" alt=""></div><div>${i.title}</div><div class="mi-qty">x${i.qty}</div></div>`)}
          <div class="line" style="margin-top:14px"><span>Subtotal</span><span>${peso(o.subtotal)}</span></div>
          <div class="line"><span>Delivery</span><span>${o.delivery_fee ? peso(o.delivery_fee) : 'Free'}</span></div>
          <div class="line total"><span>Amount to pay</span><span class="tnum">${peso(o.total)}</span></div>
          <p class="fineprint">ManilaFinds holds your payment and pays the seller after you confirm you received the item.</p></div></aside>
      </div></div>`;
  }

  app.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-shot]')) return;
    const file = e.target.files[0];
    if (!file) return;
    const typed = readTyped();
    try { s.shot = await MF.ui.fileToDataUrl(file, 900, 0.75); s.shotError = ''; }
    catch (err) { s.shot = ''; s.shotError = err.message; }
    draw();
    restoreTyped(typed);
  });
  // The form is redrawn when a screenshot is attached or the method switched, so keep what was typed.
  const FIELDS = ['sender', 'reference', 'amount'];
  const readTyped = () => { const f = app.querySelector('form'); return f ? FIELDS.map((k) => f.elements[k].value) : []; };
  const restoreTyped = (v) => { const f = app.querySelector('form'); if (f) FIELDS.forEach((k, i) => { f.elements[k].value = v[i] || ''; }); };

  MF.ui.wire(app, {
    method: (b) => { const typed = readTyped(); s.method = b.dataset.m; draw(); restoreTyped(typed); },
    copy: (b) => { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.n) : Promise.reject()).then(() => MF.ui.toast('Number copied.'), () => MF.ui.toast('Copy is not allowed here; the number is on screen.')); },
  }, {
    proof: (f) => {
      const typed = readTyped();
      try {
        MF.pay.submitProof(MF.auth.current(), id, { method: f.elements.method.value, sender_name: f.elements.sender.value, reference: f.elements.reference.value, amount: f.elements.amount.value, screenshot: s.shot || null });
        s.shot = ''; s.error = '';
        MF.ui.toast('Proof sent. We will check it soon.');
        MF.ui.mountShell();
        draw();
      } catch (err) { s.error = err.message; draw(); restoreTyped(typed); app.querySelector('[role=alert]').scrollIntoView({ block: 'center' }); }
    },
  });
  draw();
});
