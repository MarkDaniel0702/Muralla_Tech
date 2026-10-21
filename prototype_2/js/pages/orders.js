/* Orders & account: My Orders (buyer), Incoming Orders and My Listings (seller), Saved, Notifications, Settings. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page, dateTime, fullName, methodLabel } = MF.ui;
  const O = MF.orderui;
  const app = document.getElementById('app');
  const user = MF.auth.require();
  if (!user) return;

  const staff = user.role === 'seller' || user.role === 'admin';
  const TABS = [['orders', 'My Orders', 'bag'], ['seller-orders', 'Incoming Orders', 'truck'], ['listings', 'My Listings', 'tag'], ['saved', 'Saved Items', 'heart'], ['notifications', 'Notifications', 'chip'], ['settings', 'Settings', 'user']]
    .filter((t) => staff || !['seller-orders', 'listings'].includes(t[0]));
  const asked = MF.ui.params().get('tab');
  const tab = TABS.some((t) => t[0] === asked) ? asked : 'orders';
  const ui = { cancelFor: null, filter: 'all', message: '', error: '', newNotes: new Set() };

  const flash = (kind, text) => { ui[kind] = text; };
  const reload = () => { MF.ui.mountShell(); draw(); };
  // Runs a payment action; shows its error text instead of throwing at the user.
  function run(fn, okText) {
    try { fn(); ui.error = ''; ui.message = okText || ''; ui.cancelFor = null; if (okText) MF.ui.toast(okText); }
    catch (e) { ui.error = e.message; ui.message = ''; }
    reload();
  }

  // ---------- buyer ----------
  function buyerOrder(o) {
    const digital = MF.pay.isDigital(o);
    const proofs = MF.pay.proofsOf(o.id).sort((a, b) => b.attempt - a.attempt);
    const left = MF.db.settings().max_proof_attempts - proofs.length;
    const seller = MF.auth.find(o.seller_id);
    const canCancel = digital ? ['awaiting_payment', 'payment_rejected'].includes(o.status) : o.status === 'pending';
    return h`<article class="ord-card" data-order="${o.order_number}">
      <div class="order-head"><div><b class="order-number">${o.order_number}</b><span class="order-meta">Placed ${dateTime(o.created_at)}</span></div>${MF.ui.statusPill(o.status)}</div>
      <p class="order-meta" style="margin-bottom:10px">Seller: <a href="${page('browse')}?seller=${o.seller_id}" style="color:var(--palm)">${fullName(seller, 'ManilaFinds seller')}</a></p>
      ${o.status === 'cancelled' ? h`<div class="notice notice--error" role="status">Cancelled by ${o.cancelled_by === 'buyer' ? 'you' : 'the seller'}${o.cancel_reason ? ': ' + o.cancel_reason : ''}. Your items were returned to stock and nothing is owed.</div>` : O.tracker(o)}
      ${O.items(o)}${O.totals(o)}
      <p class="order-meta" style="margin:12px 0 4px"><b>${o.delivery_method === 'meetup' ? 'Meet-up' : 'Standard delivery'}</b>${o.delivery_method === 'standard' ? ': ' + o.details.first_name + ' ' + o.details.last_name + ', ' + o.details.address : ''}</p>
      ${o.status !== 'cancelled' ? h`<p class="order-meta">${digital ? methodLabel(o.payment_method) + ': ' + peso(o.total) + ' paid to ManilaFinds, which pays the seller after you receive the item.' : 'Payment is arranged directly between you and the seller.'}</p>` : ''}
      ${digital && o.status === 'awaiting_payment' ? h`<div class="notice" role="status"><span><b>Payment needed.</b> Send ${methodLabel(o.payment_method)} payment to ManilaFinds, then submit your proof.</span><a class="btn btn--primary btn--sm" href="${page('pay')}?id=${o.id}">Pay now</a></div>` : ''}
      ${digital && o.status === 'payment_rejected' ? h`<div class="notice notice--error" role="alert"><span><b>Payment not approved</b>${proofs[0] && proofs[0].reject_reason ? ': ' + proofs[0].reject_reason : ''}. ${left > 0 ? 'You can send corrected proof (' + left + ' left).' : 'No attempts left; please contact support.'}</span>${left > 0 ? h`<a class="btn btn--primary btn--sm" href="${page('pay')}?id=${o.id}">Send corrected proof</a>` : ''}</div>` : ''}
      ${digital && o.status === 'payment_submitted' ? h`<div class="notice" role="status"><span>Your proof of payment is being checked. We will notify you once it is approved.</span><a class="btn btn--ghost btn--sm" href="${page('pay')}?id=${o.id}">View</a></div>` : ''}
      ${digital && o.status === 'payment_confirmed' ? (o.handed_over_at ? h`
        <div class="ord-actions" style="margin-top:12px;margin-bottom:0"><span class="order-meta" style="align-self:center">Payment approved and the seller handed over the item. Got it?</span>
          <button type="button" class="btn btn--sm btn--primary" data-act="received" data-id="${o.id}">I received the item</button></div>` : h`
        <div class="notice notice--ok" role="status"><span>Payment approved. Waiting for the seller to hand over your item.</span></div>`) : ''}
      ${cancelControls(o, canCancel)}
      ${O.history(o)}
    </article>`;
  }

  function cancelControls(o, can) {
    if (!can) return '';
    return ui.cancelFor === o.id ? h`<form class="order-reject" data-form="cancel" data-id="${o.id}">
        <label for="why-${o.id}">Reason (optional)</label><textarea id="why-${o.id}" name="reason" rows="2" maxlength="300" placeholder="e.g. Changed my mind"></textarea>
        <div class="ord-actions" style="margin-bottom:0"><button type="submit" class="btn btn--sm btn--primary">Yes, cancel the order</button><button type="button" class="btn btn--sm btn--ghost" data-act="cancel-no">Keep order</button></div></form>`
      : h`<div class="ord-actions" style="margin-top:12px;margin-bottom:0"><button type="button" class="btn btn--sm btn--ghost" data-act="cancel-ask" data-id="${o.id}">Cancel order</button></div>`;
  }

  // ---------- seller ----------
  function sellerOrder(o) {
    const digital = MF.pay.isDigital(o);
    const buyer = MF.auth.find(o.buyer_id);
    const d = o.details;
    const canCancel = digital ? ['awaiting_payment', 'payment_rejected'].includes(o.status) : ['pending', 'confirmed'].includes(o.status);
    return h`<article class="ord-card" data-order="${o.order_number}">
      <div class="order-head"><div><b class="order-number">${o.order_number}</b><span class="order-meta">Received ${dateTime(o.created_at)}</span></div>${MF.ui.statusPill(o.status)}</div>
      <div class="order-contact"><b>${fullName(buyer, d.first_name + ' ' + d.last_name)}</b> · <a href="tel:${d.phone.replace(/[^\d+]/g, '')}">${d.phone}</a>
        <div class="order-meta">${o.delivery_method === 'meetup' ? 'Meet-up: arrange a safe place to meet with the buyer' : 'Standard delivery: ' + d.address}</div>
        ${d.notes ? h`<div class="order-meta">Note from buyer: ${d.notes}</div>` : ''}</div>
      ${o.status === 'cancelled' ? h`<div class="notice notice--error" role="status">Cancelled by ${o.cancelled_by === 'seller' ? 'you' : 'the buyer'}${o.cancel_reason ? ': ' + o.cancel_reason : ''}.</div>` : O.tracker(o)}
      ${O.items(o)}${O.totals(o)}
      ${digital ? h`
        <p class="order-meta" style="margin:10px 0 6px">Payment: the buyer pays ManilaFinds by ${methodLabel(o.payment_method)}. ManilaFinds pays you after the buyer confirms they received the item.</p>
        ${o.status === 'payment_confirmed' && !o.handed_over_at ? h`<div class="notice notice--ok" role="status"><span><b>Paid. Hand over the item to the buyer</b>, then mark it as handed over.</span><button type="button" class="btn btn--sm btn--primary" data-act="handover" data-id="${o.id}">Mark as handed over</button></div>` : ''}
        ${o.status === 'payment_confirmed' && o.handed_over_at ? h`<div class="notice" role="status"><span>Handed over ${dateTime(o.handed_over_at)}. Waiting for the buyer to confirm receipt; then your payout is queued.</span></div>` : ''}
        ${['awaiting_payment', 'payment_submitted', 'payment_rejected'].includes(o.status) ? h`<div class="notice" role="status"><span>Waiting for the buyer's payment to be confirmed. Do not hand over the item yet.</span></div>` : ''}
        ${o.status !== 'cancelled' ? O.payoutBox(o, 'seller') : ''}
        ${o.status === 'completed' && o.payment.payout_status === 'pending_release' && !user.payout_account ? h`<div class="notice notice--error" role="alert"><span>Add a payout account in <a href="${page('orders')}?tab=settings" style="text-decoration:underline">Settings</a> so ManilaFinds can send your payout.</span></div>` : ''}`
      : h`<p class="order-meta" style="margin:10px 0 0">Payment: arranged directly between you and the buyer at the meet-up. Nothing is paid through ManilaFinds.</p>
          ${o.status === 'pending' ? h`<div class="ord-actions" style="margin-top:14px;margin-bottom:0"><button type="button" class="btn btn--sm btn--primary" data-act="confirm-meetup" data-id="${o.id}">Confirm order</button></div>` : ''}
          ${o.status === 'confirmed' ? h`<div class="ord-actions" style="margin-top:14px;margin-bottom:0"><button type="button" class="btn btn--sm btn--primary" data-act="handover" data-id="${o.id}">Mark as handed over (completed)</button></div>` : ''}`}
      ${cancelControls(o, canCancel)}
      ${O.history(o)}
    </article>`;
  }

  // ---------- tabs ----------
  const listBlock = (list, render, empty) => (list.length ? list.map(render) : h`<div class="empty" style="max-width:420px;margin:30px auto">${empty}</div>`);

  function ordersTab() {
    return h`<h1>My Orders</h1><p class="sub">Everything you have bought, newest first.</p>
      ${listBlock(MF.pay.forBuyer(user.id), buyerOrder, h`<h3>No orders yet</h3><p>When you buy items, they will appear here.</p><a class="btn btn--primary" style="margin-top:14px" href="${page('browse')}">Start shopping</a>`)}`;
  }

  function sellerOrdersTab() {
    const all = MF.pay.forSeller(user.id);
    const keys = ['all'].concat(Object.keys(MF.ui.STATUS).filter((k) => all.some((o) => o.status === k) || k === ui.filter));
    const list = ui.filter === 'all' ? all : all.filter((o) => o.status === ui.filter);
    return h`<h1>Incoming Orders</h1><p class="sub">Orders for your items. Hand over paid items and track your payouts.</p>
      <div class="order-filters" role="group" aria-label="Filter orders">${keys.map((k) => h`<button type="button" class="btn btn--sm ${ui.filter === k ? 'btn--primary' : 'btn--ghost'}" data-act="filter" data-k="${k}" aria-pressed="${String(ui.filter === k)}">${k === 'all' ? 'All' : MF.ui.STATUS[k][0]} (${k === 'all' ? all.length : all.filter((o) => o.status === k).length})</button>`)}</div>
      ${listBlock(list, sellerOrder, h`<h3>No orders here</h3><p>When a buyer orders one of your items, it shows up straight away.</p>`)}`;
  }

  function listingsTab() {
    const mine = MF.listings.all().filter((l) => l.seller_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pill = { approved: ['Published', 'pill--ok'], pending: ['Awaiting review', 'pill--warn'], rejected: ['Rejected', 'pill--danger'] };
    return h`<h1>My Listings</h1><p class="sub">${mine.length} listing${mine.length === 1 ? '' : 's'}. <a href="${page('sell')}" style="color:var(--palm);font-weight:700">List a new item</a></p>
      ${mine.length ? h`<div class="list-manage">${mine.map((l) => h`<div class="lm-card"><div class="med"><img src="${url(MF.listings.photoOf(l))}" alt=""></div>
        <div class="bd"><b>${l.title}</b><div class="pr">${peso(l.price)}</div>
          <div style="margin-bottom:8px"><span class="pill ${pill[l.status][1]}">${pill[l.status][0]}</span> <span class="order-meta" style="display:inline">${l.stock} in stock</span></div>
          ${l.admin_note ? h`<p class="lm-reason" style="font-size:.8rem;color:var(--danger);margin-bottom:8px">Admin note: ${l.admin_note}</p>` : ''}
          <form data-form="edit-listing" data-id="${l.id}" style="display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
            <div class="field" style="margin:0;flex:1;min-width:80px"><label for="lp-${l.id}">Price ₱</label><input id="lp-${l.id}" name="price" type="number" min="1" step="0.01" value="${l.price}"></div>
            <div class="field" style="margin:0;width:70px"><label for="ls-${l.id}">Stock</label><input id="ls-${l.id}" name="stock" type="number" min="0" value="${l.stock}"></div>
            <button type="submit" class="btn btn--ghost btn--sm">Save</button></form>
          <div class="acts"><a href="${page('listing')}?id=${l.id}">View</a>
            ${ui.cancelFor === l.id ? h`<button type="button" class="linkbtn del" style="color:var(--danger)" data-act="del-yes" data-id="${l.id}">Yes, delete</button><button type="button" class="linkbtn" data-act="cancel-no">Keep</button>`
              : h`<button type="button" class="linkbtn del" style="color:var(--danger)" data-act="del-ask" data-id="${l.id}">Delete</button>`}</div></div></div>`)}</div>`
        : h`<div class="empty" style="max-width:420px;margin:30px auto"><h3>No listings yet</h3><p>List your first electronics item.</p><a class="btn btn--primary" style="margin-top:14px" href="${page('sell')}">List an item</a></div>`}`;
  }

  function savedTab() {
    const items = MF.listings.saved().map(MF.listings.byId).filter((l) => l && l.status === 'approved');
    return h`<h1>Saved Items</h1><p class="sub">Your favorites on this device.</p>
      ${items.length ? h`<div class="card-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${items.map((l) => h`<div>${MF.card.render(l)}<button type="button" class="btn btn--ghost btn--sm btn--block" style="margin-top:8px" data-act="unsave" data-id="${l.id}">Remove from saved</button></div>`)}</div>`
        : h`<div class="empty" style="max-width:420px;margin:30px auto"><h3>Nothing saved yet</h3><p>Tap the heart on a listing to save it.</p><a class="btn btn--primary" style="margin-top:14px" href="${page('browse')}">Browse listings</a></div>`}`;
  }

  function notificationsTab() {
    const notes = MF.pay.notesFor(user.id);
    notes.forEach((n) => { if (!n.read) ui.newNotes.add(n.id); });
    MF.pay.markRead(user.id);
    return h`<h1>Notifications</h1><p class="sub">Updates about your orders and payments.</p>
      ${notes.length ? h`<ul class="notif-list">${notes.map((n) => h`<li class="notif${ui.newNotes.has(n.id) ? ' is-new' : ''}"><div><b>${n.title}</b><p>${n.body}</p><span class="order-meta">${dateTime(n.at)}</span></div>
        ${n.link ? h`<a class="btn btn--ghost btn--sm" href="${MF.root}pages/${n.link}">Open</a>` : ''}</li>`)}</ul>`
        : h`<div class="empty" style="max-width:420px;margin:30px auto"><h3>No notifications</h3><p>You are all caught up.</p></div>`}`;
  }

  function settingsTab() {
    const pa = user.payout_account || {};
    return h`<h1>Account Settings</h1><p class="sub">${user.email} · ${user.role}</p>
      ${ui.error ? MF.ui.notice('error', ui.error) : ''}${ui.message ? MF.ui.notice('ok', ui.message) : ''}
      <form class="co-panel" data-form="profile" style="max-width:560px"><h2>Profile</h2>
        <div class="field-row"><div class="field"><label for="st-first">First name</label><input id="st-first" name="first_name" value="${user.first_name}"></div>
          <div class="field"><label for="st-last">Last name</label><input id="st-last" name="last_name" value="${user.last_name}"></div></div>
        <button type="submit" class="btn btn--primary">Save profile</button></form>
      ${staff ? h`<form class="co-panel" data-form="payout" style="max-width:560px;margin-top:20px"><h2>Payout account</h2>
        <p class="order-meta" style="margin-bottom:14px">For orders paid by GCash or Maya, ManilaFinds keeps a 5% platform fee and sends you the rest here after the buyer confirms receipt.${user.payout_account ? ' Currently: ' + methodLabel(pa.method) + ' ' + pa.account_number + ' (' + pa.account_name + ').' : ' No account saved yet.'}</p>
        <div class="field-row"><div class="field"><label for="po-method">Send payouts to</label><select id="po-method" name="method"><option value="gcash"${pa.method === 'gcash' ? ' selected' : ''}>GCash</option><option value="maya"${pa.method === 'maya' ? ' selected' : ''}>Maya</option></select></div>
          <div class="field"><label for="po-number">Account number</label><input id="po-number" name="number" inputmode="numeric" maxlength="20" placeholder="0917 123 4567" value="${pa.account_number || ''}"></div></div>
        <div class="field"><label for="po-name">Account name</label><input id="po-name" name="name" maxlength="80" placeholder="As registered in the app" value="${pa.account_name || ''}"></div>
        <button type="submit" class="btn btn--primary">Save payout account</button></form>` : ''}
      <p style="margin-top:20px"><button type="button" class="btn btn--ghost" data-act="logout">Log out</button></p>`;
  }

  function draw() {
    const fresh = MF.auth.current();
    Object.assign(user, fresh);
    const body = { orders: ordersTab, 'seller-orders': sellerOrdersTab, listings: listingsTab, saved: savedTab, notifications: notificationsTab, settings: settingsTab }[tab];
    const todo = staff ? MF.pay.sellerTodo(user.id) : 0;
    document.title = TABS.find((t) => t[0] === tab)[1] + ' - ManilaFinds';
    app.innerHTML = h`<div class="wrap section"><div class="account-layout">
      <aside class="acct-side"><div class="acct-user"><div class="av">${user.first_name[0].toUpperCase()}</div><div><b>${fullName(user)}</b><span>${user.role}</span></div></div>
        <nav class="acct-nav" aria-label="Account">${TABS.map(([k, label, ic]) => h`<a href="?tab=${k}" class="${k === tab ? 'on' : ''}"${k === tab ? ' aria-current="page"' : ''}>${icon(ic, 16)}${label}${k === 'seller-orders' && todo ? h`<span class="count-badge">${todo}</span>` : ''}${k === 'notifications' && MF.pay.unread(user.id) ? h`<span class="count-badge">${MF.pay.unread(user.id)}</span>` : ''}</a>`)}</nav></aside>
      <div class="acct-body">${tab !== 'settings' && ui.error ? MF.ui.notice('error', ui.error) : ''}${body()}</div></div></div>`;
    if (tab === 'notifications') MF.ui.mountShell();
  }

  const me = () => MF.auth.current();
  MF.ui.wire(app, {
    received: (b) => run(() => MF.pay.confirmReceived(me(), b.dataset.id), 'Thanks! The order is completed and the seller\'s payout is queued.'),
    handover: (b) => run(() => MF.pay.markHandedOver(me(), b.dataset.id), 'Marked as handed over.'),
    'confirm-meetup': (b) => run(() => MF.pay.confirmMeetup(me(), b.dataset.id), 'Order confirmed.'),
    'cancel-ask': (b) => { ui.cancelFor = b.dataset.id; draw(); app.querySelector('textarea').focus(); },
    'cancel-no': () => { ui.cancelFor = null; draw(); },
    filter: (b) => { ui.filter = b.dataset.k; draw(); },
    unsave: (b) => { MF.listings.toggleSaved(b.dataset.id); draw(); },
    'del-ask': (b) => { ui.cancelFor = b.dataset.id; draw(); },
    'del-yes': (b) => run(() => MF.listings.remove(me(), b.dataset.id), 'Listing deleted.'),
    logout: () => { MF.auth.logout(); location.href = page('index'); },
  }, {
    cancel: (f) => run(() => MF.pay.cancelOrder(me(), f.dataset.id, f.elements.reason.value), 'Order cancelled.'),
    'edit-listing': (f) => run(() => MF.listings.edit(me(), f.dataset.id, { price: f.elements.price.value, stock: f.elements.stock.value }), 'Listing updated.'),
    profile: (f) => { MF.auth.update(user.id, { first_name: f.elements.first_name.value.trim() || user.first_name, last_name: f.elements.last_name.value.trim() || user.last_name }); flash('message', 'Profile updated.'); ui.error = ''; reload(); },
    payout: (f) => run(() => MF.auth.savePayoutAccount(me(), { method: f.elements.method.value, account_name: f.elements.name.value, account_number: f.elements.number.value }), 'Payout account saved.'),
  });
  draw();
});
