/* Orders and the mock payment module. No money moves anywhere: GCash / Maya payments are people-checked proofs.
   Every action takes the acting user and re-checks role, ownership and current status itself, so the screens
   only decide what to show. Every status change is written to the event log with the actor and the time.

   Digital order:  awaiting_payment -> payment_submitted -> payment_confirmed -> completed
                          ^                   |  (admin rejects)
                          +-- payment_rejected <+          cancelled: only before any money is held
   Meet-up order:  pending -> confirmed -> completed (+ cancelled). Payment is arranged directly; the platform
                   takes no proof, no fee and makes no payout.
   Payout:         not_due -> pending_release (buyer confirms receipt) -> released (admin sends it) */
(function () {
  const MF = window.MF;
  const { round2 } = MF.ui;

  const orders = () => MF.db.get('orders');
  const byId = (id) => orders().find((o) => o.id === id) || null;
  const saveOrders = (list) => MF.db.save('orders', list);
  const isDigital = (o) => o.payment_method === 'gcash' || o.payment_method === 'maya';
  const proofsOf = (orderId) => MF.db.get('proofs').filter((p) => p.order_id === orderId);
  const normRef = (s) => String(s || '').replace(/[\s-]/g, '').toUpperCase();
  const cents = (n) => Math.round(Number(n) * 100);
  const isParty = (u, o) => o.buyer_id === u.id || o.seller_id === u.id;

  function log(order, actor, kind, from, to, note) {
    const events = MF.db.get('events');
    events.push({ id: MF.uid('ev'), at: MF.now(), order_id: order.id, order_number: order.order_number, actor_id: actor.id, actor_name: MF.ui.fullName(actor), actor_role: actor.role, kind, from, to, note: note || '' });
    MF.db.save('events', events);
  }
  function setStatus(order, actor, to, note) {
    const from = order.status;
    order.status = to;
    log(order, actor, 'status', from, to, note);
  }

  function notify(userId, title, body, link) {
    const notes = MF.db.get('notes');
    notes.push({ id: MF.uid('n'), user_id: userId, title, body, link: link || '', at: MF.now(), read: false });
    MF.db.save('notes', notes);
  }
  const notifyAdmins = (title, body, link) => MF.db.get('users').filter((u) => u.role === 'admin').forEach((a) => notify(a.id, title, body, link));
  const unread = (userId) => MF.db.get('notes').filter((n) => n.user_id === userId && !n.read).length;
  const notesFor = (userId) => MF.db.get('notes').filter((n) => n.user_id === userId).sort((a, b) => b.at.localeCompare(a.at));
  function markRead(userId) { MF.db.save('notes', MF.db.get('notes').map((n) => (n.user_id === userId ? Object.assign(n, { read: true }) : n))); }

  const need = (cond, msg) => { if (!cond) throw new Error(msg); };

  // ---- checkout ----
  // lines: [{ listing, qty }] from MF.cart.resolve(). One order per seller. details: { delivery, method, first_name, last_name, phone, address, notes }
  function placeOrder(buyer, lines, d) {
    need(buyer, 'Please log in first.');
    need(lines.length, 'Your cart is empty.');
    const settings = MF.db.settings();
    const meetup = d.delivery === 'meetup';
    need(meetup || d.delivery === 'standard', 'Choose standard delivery or meet-up.');
    const method = meetup ? 'meetup' : d.method;
    if (!meetup) {
      need(['gcash', 'maya'].includes(method), 'Choose GCash or Maya.');
      need(settings.platform_accounts[method] && settings.platform_accounts[method].active, MF.ui.methodLabel(method) + ' is not available right now. Choose another method.');
    }
    need(d.first_name.trim() && d.last_name.trim(), 'Please enter your first and last name.');
    const digits = String(d.phone || '').replace(/\D/g, '');
    need(digits.length >= 7 && digits.length <= 15, 'Please enter a phone number the seller can reach you on.');
    need(meetup || String(d.address || '').trim(), 'Please enter your delivery address.');

    const listings = MF.listings.all();
    const bySeller = {};
    for (const { listing, qty } of lines) {
      const live = listings.find((l) => l.id === listing.id);
      need(live && live.status === 'approved', '"' + listing.title + '" is no longer available.');
      need(live.stock >= qty, 'Only ' + live.stock + ' of "' + live.title + '" left.');
      need(live.seller_id !== buyer.id, 'You cannot buy your own listing ("' + live.title + '").');
      (bySeller[live.seller_id] = bySeller[live.seller_id] || []).push({ live, qty });
    }

    const created = [];
    for (const sellerId of Object.keys(bySeller)) {
      const items = bySeller[sellerId];
      const subtotal = items.reduce((n, x) => n + x.live.price * x.qty, 0);
      const delivery_fee = meetup ? 0 : settings.delivery_fee;
      const order = {
        id: MF.uid('o'), order_number: MF.db.nextOrderNumber(), buyer_id: buyer.id, seller_id: sellerId,
        items: items.map((x) => ({ listing_id: x.live.id, title: x.live.title, image: MF.listings.photoOf(x.live), qty: x.qty, unit_price: x.live.price })),
        subtotal, delivery_fee, total: subtotal + delivery_fee, delivery_method: d.delivery, payment_method: method,
        details: { first_name: d.first_name.trim(), last_name: d.last_name.trim(), phone: d.phone.trim(), address: (d.address || '').trim(), notes: (d.notes || '').trim() },
        status: meetup ? 'pending' : 'awaiting_payment', handed_over_at: null, created_at: MF.now(), completed_at: null, cancel_reason: '', cancelled_by: '',
        // Fee is 5% of the item price on digital payments only; meet-up orders have no payment record at all.
        payment: meetup ? null : {
          amount_due: subtotal + delivery_fee, amount_paid: null, fee_rate: settings.fee_rate,
          platform_fee: round2(subtotal * settings.fee_rate), seller_payout: round2(subtotal - round2(subtotal * settings.fee_rate)),
          payout_status: 'not_due', payout_reference: null, released_at: null,
        },
      };
      created.push(order);
      items.forEach((x) => { x.live.stock -= x.qty; });
    }
    const all = orders().concat(created);
    need(saveOrders(all) && MF.db.save('listings', listings), 'Your browser storage is full, so the order was not saved.');
    created.forEach((o) => {
      log(o, buyer, 'status', null, o.status, 'Order placed');
      notify(o.seller_id, 'New order ' + o.order_number, MF.ui.fullName(buyer) + ' ordered ' + o.items.map((i) => i.title).join(', ') + '.', 'orders.html?tab=seller-orders');
    });
    return created;
  }

  // ---- buyer: proof of payment ----
  function submitProof(buyer, orderId, f) {
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && o.buyer_id === buyer.id, 'This order does not exist or is not yours to pay.');
    need(isDigital(o), 'This order is paid directly at the meet-up, so there is no proof to send.');
    need(['awaiting_payment', 'payment_rejected'].includes(o.status), 'This order is not waiting for a payment right now.');
    const settings = MF.db.settings();
    const prior = proofsOf(o.id);
    need(prior.length < settings.max_proof_attempts, 'No attempts are left. Please contact ManilaFinds support.');
    need(['gcash', 'maya'].includes(f.method), 'Choose GCash or Maya.');
    need(String(f.sender_name || '').trim().length >= 2, 'Enter the name on the account you paid from.');
    const ref = normRef(f.reference);
    need(/^[A-Z0-9]{6,30}$/.test(ref), 'Enter the reference number from your receipt (6 to 30 letters or digits).');
    need(cents(f.amount) === cents(o.total), 'The amount must be exactly ' + MF.ui.peso(o.total) + ' (the order total).');
    // A reference number can be used once. A rejected proof frees its number so a typo can be corrected.
    need(!MF.db.get('proofs').some((p) => p.reference === ref && p.status !== 'rejected'), 'That reference number was already used in another payment.');

    const proofs = MF.db.get('proofs');
    proofs.push({ id: MF.uid('p'), order_id: o.id, attempt: prior.length + 1, method: f.method, sender_name: f.sender_name.trim(), reference: ref, amount: Number(f.amount), screenshot: f.screenshot || null, status: 'pending', reject_reason: '', submitted_at: MF.now(), reviewed_at: null, reviewer_id: null });
    need(MF.db.save('proofs', proofs), 'Your browser storage is full. Send without the screenshot (it is optional).');
    setStatus(o, buyer, 'payment_submitted', 'Proof sent: ' + MF.ui.methodLabel(f.method) + ' ref ' + ref);
    saveOrders(all);
    notifyAdmins('Payment to review', o.order_number + ': ' + MF.ui.peso(o.total) + ' via ' + MF.ui.methodLabel(f.method) + ', ref ' + ref + '.', 'admin.html#payments');
  }

  // ---- admin: payment confirmation ----
  function reviewProof(admin, proofId, approve, reason) {
    need(admin && admin.role === 'admin', 'Only admins can confirm payments.');
    const proofs = MF.db.get('proofs');
    const p = proofs.find((x) => x.id === proofId);
    need(p && p.status === 'pending', 'That proof was already reviewed.');
    const all = orders();
    const o = all.find((x) => x.id === p.order_id);
    need(o && o.status === 'payment_submitted', 'That order is not waiting for payment review.');
    need(!isParty(admin, o), 'This is your own order, so another admin has to review it.');
    const why = String(reason || '').trim();
    if (approve) {
      // Approve only when the money arrived and sender, reference and amount all match what the buyer typed.
      need(cents(p.amount) === cents(o.total), 'The amount does not match the order total, so this payment cannot be approved.');
      p.status = 'approved';
      o.payment.amount_paid = p.amount;
      setStatus(o, admin, 'payment_confirmed', 'Payment approved (ref ' + p.reference + ')');
      notify(o.buyer_id, 'Payment approved', o.order_number + ': your payment was confirmed. The seller will hand over your item.', 'pay.html?id=' + o.id);
      notify(o.seller_id, 'Paid: hand over ' + o.order_number, 'The buyer\'s payment was confirmed. Hand over the item, then mark it as handed over.', 'orders.html?tab=seller-orders');
    } else {
      need(why.length >= 3, 'Give the buyer a reason (at least 3 characters).');
      p.status = 'rejected';
      p.reject_reason = why;
      setStatus(o, admin, 'payment_rejected', 'Payment rejected: ' + why);
      notify(o.buyer_id, 'Payment not approved', o.order_number + ': ' + why, 'pay.html?id=' + o.id);
    }
    p.reviewed_at = MF.now();
    p.reviewer_id = admin.id;
    MF.db.save('proofs', proofs);
    saveOrders(all);
  }

  // ---- seller ----
  function confirmMeetup(seller, orderId) {
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && o.seller_id === seller.id, 'This is not your order.');
    need(o.payment_method === 'meetup' && o.status === 'pending', 'This order cannot be confirmed.');
    setStatus(o, seller, 'confirmed', 'Seller confirmed the meet-up');
    saveOrders(all);
    notify(o.buyer_id, 'Order confirmed', o.order_number + ': the seller confirmed. Arrange the meet-up and payment with them.', 'orders.html?tab=orders');
  }

  // Digital orders: only after the payment is confirmed. Meet-up orders: handing over completes the order.
  function markHandedOver(seller, orderId) {
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && o.seller_id === seller.id, 'This is not your order.');
    if (isDigital(o)) {
      need(o.status === 'payment_confirmed', 'Wait until the payment is confirmed before handing over the item.');
      need(!o.handed_over_at, 'Already marked as handed over.');
      o.handed_over_at = MF.now();
      log(o, seller, 'handover', o.status, o.status, 'Seller marked the item as handed over');
      notify(o.buyer_id, 'Item handed over', o.order_number + ': the seller says it was handed over. Confirm in My Orders once you have it.', 'orders.html?tab=orders');
    } else {
      need(o.status === 'confirmed', 'Confirm the order first.');
      o.handed_over_at = MF.now();
      o.completed_at = MF.now();
      setStatus(o, seller, 'completed', 'Handed over at the meet-up');
      notify(o.buyer_id, 'Order completed', o.order_number + ' is completed.', 'orders.html?tab=orders');
    }
    saveOrders(all);
  }

  // ---- buyer: receipt ----
  function confirmReceived(buyer, orderId) {
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && o.buyer_id === buyer.id, 'This is not your order.');
    need(isDigital(o) && o.status === 'payment_confirmed', 'This order is not waiting for you to confirm receipt.');
    need(o.handed_over_at, 'The seller has not marked the item as handed over yet.');
    o.completed_at = MF.now();
    o.payment.payout_status = 'pending_release';
    setStatus(o, buyer, 'completed', 'Buyer confirmed receipt');
    saveOrders(all);
    notify(o.seller_id, 'Order completed', o.order_number + ': the buyer received the item. Your payout of ' + MF.ui.peso(payoutTransfer(o)) + ' is pending release.', 'orders.html?tab=seller-orders');
    notifyAdmins('Payout to release', o.order_number + ' is completed.', 'admin.html#payouts');
  }

  // ---- admin: payout ----
  function releasePayout(admin, orderId, reference) {
    need(admin && admin.role === 'admin', 'Only admins can release payouts.');
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && isDigital(o), 'Order not found.');
    need(o.status === 'completed', 'A payout is released only after the order is completed.');
    need(o.payment.payout_status === 'pending_release', 'This payout is not waiting to be released.');
    need(!isParty(admin, o), 'This is your own order, so another admin has to release the payout.');
    const seller = MF.auth.find(o.seller_id);
    need(seller && seller.payout_account, 'The seller has not added a payout account yet.');
    const ref = normRef(reference);
    need(/^[A-Z0-9]{6,30}$/.test(ref), 'Enter the reference number of the transfer you sent (6 to 30 letters or digits).');
    o.payment.payout_status = 'released';
    o.payment.payout_reference = ref;
    o.payment.released_at = MF.now();
    saveOrders(all);
    log(o, admin, 'payout', 'pending_release', 'released', 'Payout sent to ' + MF.ui.methodLabel(seller.payout_account.method) + ', ref ' + ref);
    notify(o.seller_id, 'Payout sent', o.order_number + ': ' + MF.ui.peso(payoutTransfer(o)) + ' was sent to your ' + MF.ui.methodLabel(seller.payout_account.method) + '. Ref ' + ref + '.', 'orders.html?tab=seller-orders');
  }

  // ---- cancel (before any money is held; there are no refunds in this prototype) ----
  function cancelOrder(actor, orderId, reason) {
    const all = orders();
    const o = all.find((x) => x.id === orderId);
    need(o && (o.buyer_id === actor.id || o.seller_id === actor.id), 'This is not your order.');
    const open = isDigital(o) ? ['awaiting_payment', 'payment_rejected'] : o.seller_id === actor.id ? ['pending', 'confirmed'] : ['pending'];
    need(open.includes(o.status), 'This order can no longer be cancelled.');
    const by = o.buyer_id === actor.id ? 'buyer' : 'seller';
    o.cancelled_by = by;
    o.cancel_reason = String(reason || '').trim();
    const listings = MF.listings.all();
    o.items.forEach((i) => { const l = listings.find((x) => x.id === i.listing_id); if (l) l.stock += i.qty; }); // items go back on sale
    MF.db.save('listings', listings);
    setStatus(o, actor, 'cancelled', 'Cancelled by the ' + by + (o.cancel_reason ? ': ' + o.cancel_reason : ''));
    saveOrders(all);
    notify(by === 'buyer' ? o.seller_id : o.buyer_id, 'Order cancelled', o.order_number + ' was cancelled by the ' + by + (o.cancel_reason ? ': ' + o.cancel_reason : '.'), 'orders.html');
  }

  // ---- queries for the screens ----
  const forBuyer = (id) => orders().filter((o) => o.buyer_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const forSeller = (id) => orders().filter((o) => o.seller_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const payoutTransfer = (o) => round2(o.payment.seller_payout + o.delivery_fee); // the seller also keeps the delivery fee
  const sellerTodo = (id) => forSeller(id).filter((o) => (isDigital(o) ? o.status === 'payment_confirmed' && !o.handed_over_at : ['pending', 'confirmed'].includes(o.status))).length;
  const eventsFor = (orderId) => MF.db.get('events').filter((e) => e.order_id === orderId).sort((a, b) => a.at.localeCompare(b.at));

  MF.pay = { isDigital, byId, orders, forBuyer, forSeller, proofsOf, normRef, placeOrder, submitProof, reviewProof, confirmMeetup, markHandedOver, confirmReceived, releasePayout, cancelOrder, notify, notifyAdmins, unread, notesFor, markRead, payoutTransfer, sellerTodo, eventsFor };
})();
