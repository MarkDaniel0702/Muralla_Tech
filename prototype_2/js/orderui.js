/* Order pieces shared by the Orders page (buyer / seller views) and the admin dashboard. */
(function () {
  const MF = window.MF;
  const { h, peso, url, dateTime, methodLabel } = MF.ui;

  const items = (o) => h`<div class="order-lines">${o.items.map((i) => h`<div class="order-line"><img class="order-thumb" src="${url(i.image)}" alt="">
    <div class="order-line__main"><b>${i.title}</b><span>${i.qty} × ${peso(i.unit_price)}</span></div><div class="order-line__total">${peso(i.qty * i.unit_price)}</div></div>`)}</div>`;

  const totals = (o) => h`<div class="line"><span>Subtotal</span><span>${peso(o.subtotal)}</span></div>
    <div class="line"><span>Delivery</span><span>${o.delivery_fee ? peso(o.delivery_fee) : 'Free'}</span></div>
    <div class="line total"><span>Total</span><span>${peso(o.total)}</span></div>`;

  // Digital: Placed -> Proof sent -> Paid -> Handed over -> Received. Meet-up: Placed -> Confirmed -> Completed.
  function tracker(o) {
    const digital = MF.pay.isDigital(o);
    const steps = digital
      ? [['awaiting_payment', 'Placed'], ['payment_submitted', 'Proof sent'], ['payment_confirmed', 'Paid'], ['handed', 'Handed over'], ['completed', 'Received']]
      : [['pending', 'Placed'], ['confirmed', 'Confirmed'], ['completed', 'Completed']];
    let cur = o.status === 'payment_rejected' ? 0 : steps.findIndex((s) => s[0] === o.status);
    if (digital && o.status === 'payment_confirmed' && o.handed_over_at) cur = 3;
    return h`<div class="track" aria-label="Order status: ${(MF.ui.STATUS[o.status] || [o.status])[0]}">${steps.map(([, label], i) => {
      const done = i < cur || (i === cur && o.status === 'completed');
      return h`<div class="s ${done ? 'done' : ''} ${i === cur && !done ? 'now' : ''}"><i>${done ? '✓' : i + 1}</i>${label}</div>`;
    })}</div>`;
  }

  const history = (o) => {
    const ev = MF.pay.eventsFor(o.id);
    return ev.length ? h`<details class="photo-credits"><summary>Status history (${ev.length})</summary><ol class="tl" style="margin-top:10px">
      ${ev.map((e) => h`<li><b>${e.kind === 'payout' ? 'Payout ' + e.to.replace('_', ' ') : e.kind === 'handover' ? 'Handed over' : (MF.ui.STATUS[e.to] || [e.to])[0]}</b>
        <small style="display:block;color:var(--muted)">${dateTime(e.at)} · ${e.actor_name} (${e.actor_role})${e.note ? ' · ' + e.note : ''}</small></li>`)}</ol></details>` : '';
  };

  // Fee breakdown for a digital order: what the buyer paid, the 5% fee, the payout and its status.
  function payoutBox(o, who) {
    const p = o.payment;
    if (!p) return '';
    const paid = p.amount_paid != null;
    return h`<div class="payout-box">
      ${paid ? h`
        <div class="line"><span>Buyer paid Muralla Tech</span><span>${peso(p.amount_paid)}</span></div>
        <div class="line"><span>Item price</span><span>${peso(o.subtotal)}</span></div>
        <div class="line"><span>Platform fee (${Math.round(p.fee_rate * 100)}% of the item price)</span><span>−${peso(p.platform_fee)}</span></div>
        <div class="line"><span>${who === 'admin' ? 'Seller payout' : 'Your payout'} (item price − fee)</span><b>${peso(p.seller_payout)}</b></div>
        ${o.delivery_fee ? h`<div class="line"><span>Delivery fee (passed on to the seller)</span><span>+${peso(o.delivery_fee)}</span></div>` : ''}
        <div class="line total"><span>${who === 'admin' ? 'Send to seller' : 'You receive'}</span><span>${peso(MF.pay.payoutTransfer(o))}</span></div>` : h`
        <div class="line"><span>Buyer pays Muralla Tech</span><span>${peso(p.amount_due)}</span></div>
        <div class="line"><span>Platform fee (${Math.round(p.fee_rate * 100)}%) will be</span><span>${peso(p.platform_fee)}</span></div>`}
      <div class="line"><span>Payout status</span>${MF.ui.payoutPill(p.payout_status)}</div>
      ${p.payout_status === 'released' ? h`<div class="order-meta">Sent ${dateTime(p.released_at)} · reference <code>${p.payout_reference}</code></div>` : ''}
    </div>`;
  }

  MF.orderui = { items, totals, tracker, history, payoutBox, methodLabel };
})();
