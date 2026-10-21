/* Admin dashboard (admin accounts only; every action is checked again in MF.listings / MF.pay):
   Overview, Listings (moderation), Payment Confirmation (approve / reject proofs), Payouts (tracking + release),
   Payment details (Muralla Tech' GCash / Maya accounts), Activity log. */
MF.ui.boot(function () {
  const { h, icon, peso, url, page, dateTime, fullName, methodLabel } = MF.ui;
  const O = MF.orderui;
  const app = document.getElementById('app');
  const admin = MF.auth.require(['admin']);
  if (!admin) return;

  const TABS = [['overview', 'Overview'], ['listings', 'Listings'], ['payments', 'Payment Confirmation'], ['payouts', 'Payouts'], ['settings', 'Payment details'], ['log', 'Activity log']];
  const ui = { tab: TABS.some((t) => '#' + t[0] === location.hash) ? location.hash.slice(1) : 'overview', lf: 'pending', pf: 'pending', yf: 'pending_release', q: '', rejecting: null, deleting: null, toast: null };
  const me = () => MF.auth.current();
  const say = (kind, text) => { ui.toast = { kind, text }; };

  function run(fn, ok) {
    try { fn(); say('ok', ok); ui.rejecting = ui.deleting = null; } catch (e) { say('error', e.message); } // on error the open form stays open
    MF.ui.mountShell();
    draw();
    const form = app.querySelector('form[data-form^=reject]');
    if (form && ui.toast.kind === 'error') form.querySelector('textarea').focus();
  }

  const proofRows = () => MF.db.get('proofs').map((p) => ({ p, o: MF.pay.byId(p.order_id) })).filter((x) => x.o).sort((a, b) => b.p.submitted_at.localeCompare(a.p.submitted_at));
  const digitalOrders = () => MF.pay.orders().filter(MF.pay.isDigital);
  const nameOf = (id, fb) => fullName(MF.auth.find(id), fb);
  const count = (arr, f) => arr.filter(f).length;

  // ---------- overview ----------
  function overview() {
    const ls = MF.listings.all(), ds = digitalOrders();
    const done = ds.filter((o) => o.status === 'completed');
    const kpi = (tab, label, value, sub) => h`<a class="kpi" href="#${tab}" data-act="go" data-tab="${tab}"><small>${label}</small><b>${value}</b><span>${sub}</span></a>`;
    return h`<h2 style="margin-bottom:14px">Overview</h2>
      <div class="kpis">
        ${kpi('listings', 'Published listings', count(ls, (l) => l.status === 'approved'), count(ls, (l) => l.status === 'pending') + ' awaiting review')}
        ${kpi('payments', 'Payments to review', count(MF.db.get('proofs'), (p) => p.status === 'pending'), 'proofs of payment')}
        ${kpi('payouts', 'Payouts to release', count(ds, (o) => o.payment.payout_status === 'pending_release'), peso(ds.filter((o) => o.payment.payout_status === 'pending_release').reduce((n, o) => n + MF.pay.payoutTransfer(o), 0)) + ' owed to sellers')}
        <div class="kpi"><small>Platform fees earned</small><b>${peso(done.reduce((n, o) => n + o.payment.platform_fee, 0))}</b><span>${done.length} completed digital order${done.length === 1 ? '' : 's'} · 5% of item price</span></div>
        <div class="kpi"><small>All orders</small><b>${MF.pay.orders().length}</b><span>${count(MF.pay.orders(), (o) => o.status === 'completed')} completed · ${count(MF.pay.orders(), (o) => o.status === 'cancelled')} cancelled</span></div>
        <div class="kpi"><small>Accounts</small><b>${MF.db.get('users').length}</b><span>${count(MF.db.get('users'), (u) => u.role === 'seller')} sellers</span></div>
      </div>`;
  }

  // ---------- listings ----------
  function listings() {
    const all = MF.listings.all();
    const f = ui.lf;
    const term = ui.q.trim().toLowerCase();
    const list = all.filter((l) => (f === 'all' || l.status === f) && (!term || (l.title + ' ' + l.brand + ' ' + nameOf(l.seller_id)).toLowerCase().includes(term)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const chips = [['pending', 'Pending'], ['approved', 'Published'], ['rejected', 'Rejected'], ['all', 'All']];
    const pill = { approved: ['Published', 'pill--ok'], pending: ['Pending', 'pill--warn'], rejected: ['Rejected', 'pill--danger'] };
    return h`<h2 style="margin-bottom:6px">Listings</h2><p class="order-meta" style="margin-bottom:14px">Review new listings before they go live. Admin-created listings are published immediately.</p>
      <div class="order-filters" role="group" aria-label="Filter listings">${chips.map(([k, label]) => h`<button type="button" class="btn btn--sm ${f === k ? 'btn--primary' : 'btn--ghost'}" data-act="lf" data-k="${k}" aria-pressed="${String(f === k)}">${label} (${k === 'all' ? all.length : count(all, (l) => l.status === k)})</button>`)}</div>
      <div class="field" style="max-width:360px"><label for="ad-q">Search listings</label><input id="ad-q" type="search" data-q value="${ui.q}" placeholder="Title, brand or seller"></div>
      ${list.length ? list.map((l) => h`<article class="ord-card" data-listing="${l.id}">
        <div class="order-line" style="border:0;padding:0"><img class="order-thumb" style="width:64px;height:64px" src="${url(MF.listings.photoOf(l))}" alt="">
          <div class="order-line__main"><b><a href="${page('listing')}?id=${l.id}">${l.title}</a></b><span>${nameOf(l.seller_id)} · ${peso(l.price)} · ${l.stock} in stock · ${l.brand} · ${l.condition} · ${dateTime(l.created_at)}</span>
            ${l.admin_note ? h`<span style="color:var(--danger)">Note: ${l.admin_note}</span>` : ''}</div>
          <span class="pill ${pill[l.status][1]}">${pill[l.status][0]}</span></div>
        ${ui.rejecting === l.id ? h`<form class="order-reject" data-form="reject-listing" data-id="${l.id}"><label for="rl-${l.id}">Reason for the seller *</label><textarea id="rl-${l.id}" name="note" rows="2" maxlength="300" placeholder="e.g. Photos are too blurry to show the screen"></textarea>
            <div class="ord-actions" style="margin-bottom:0"><button type="submit" class="btn btn--sm btn--primary">Reject listing</button><button type="button" class="btn btn--sm btn--ghost" data-act="cancel-ui">Back</button></div></form>`
          : ui.deleting === l.id ? h`<div class="ord-actions" style="margin:12px 0 0"><span class="order-meta" style="align-self:center">Delete "${l.title}" permanently?</span><button type="button" class="btn btn--sm btn--primary" data-act="del-yes" data-id="${l.id}">Yes, delete</button><button type="button" class="btn btn--sm btn--ghost" data-act="cancel-ui">Keep</button></div>`
          : h`<div class="ord-actions" style="margin:12px 0 0">
              ${l.status !== 'approved' ? h`<button type="button" class="btn btn--sm btn--primary" data-act="approve-listing" data-id="${l.id}">Approve &amp; publish</button>` : ''}
              ${l.status !== 'rejected' ? h`<button type="button" class="btn btn--sm btn--ghost" data-act="reject-ask" data-id="${l.id}">Reject</button>` : ''}
              <button type="button" class="btn btn--sm btn--ghost" data-act="del-ask" data-id="${l.id}">Delete</button></div>`}
      </article>`) : h`<div class="empty" style="max-width:420px;margin:30px auto"><p>No ${f === 'all' ? '' : f + ' '}listings${term ? ' match "' + term + '"' : ''}.</p></div>`}`;
  }

  // ---------- payment confirmation ----------
  function payments() {
    const rows = proofRows();
    const f = ui.pf;
    const shown = rows.filter((x) => x.p.status === f);
    const chips = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
    const pill = { pending: ['Pending', 'pill--warn'], approved: ['Approved', 'pill--ok'], rejected: ['Rejected', 'pill--danger'] };
    return h`<h2 style="margin-bottom:6px">Payment Confirmation</h2>
      <p class="order-meta" style="margin-bottom:14px">Check every GCash / Maya payment against Muralla Tech' own account (demo: there is no real account, so just compare the details). Approve only when the money arrived and the sender, reference number and amount all match. Reject when the amount, sender or reference number is wrong, or the request looks fake.</p>
      <div class="order-filters" role="group" aria-label="Filter payments">${chips.map(([k, label]) => h`<button type="button" class="btn btn--sm ${f === k ? 'btn--primary' : 'btn--ghost'}" data-act="pf" data-k="${k}" aria-pressed="${String(f === k)}">${label} (${count(rows, (x) => x.p.status === k)})</button>`)}</div>
      ${shown.length ? shown.map(({ p, o }) => {
        const match = Math.round(p.amount * 100) === Math.round(o.total * 100);
        const own = o.buyer_id === admin.id || o.seller_id === admin.id;
        return h`<article class="ord-card review-card" data-order="${o.order_number}" data-proof="${p.id}">
          <div class="order-head"><div><b class="order-number">${o.order_number}</b><span class="order-meta">Submitted ${dateTime(p.submitted_at)} · attempt ${p.attempt} of 3</span></div><span class="pill ${pill[p.status][1]}">${pill[p.status][0]}</span></div>
          <div class="review-grid">
            <dl class="pay-facts review-facts">
              <div><dt>Order ID</dt><dd><b>${o.order_number}</b></dd></div>
              <div><dt>Item</dt><dd>${o.items.map((i) => i.title + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')}</dd></div>
              <div><dt>Buyer</dt><dd>${nameOf(o.buyer_id, 'Buyer')}</dd></div>
              <div><dt>Sender name</dt><dd><b>${p.sender_name}</b></dd></div>
              <div><dt>Reference number</dt><dd><code class="ref">${p.reference}</code></dd></div>
              <div><dt>Amount sent</dt><dd><b>${peso(p.amount)}</b> ${match ? h`<span class="pill pill--ok">matches total</span>` : h`<span class="pill pill--danger">order total ${peso(o.total)}</span>`}</dd></div>
              <div><dt>Method</dt><dd><b>${methodLabel(p.method)}</b></dd></div>
              <div><dt>Submitted</dt><dd>${dateTime(p.submitted_at)}</dd></div>
            </dl>
            <div class="review-shot">${p.screenshot ? h`<a href="${p.screenshot}" target="_blank" rel="noopener noreferrer"><img src="${p.screenshot}" alt="Receipt screenshot for ${o.order_number}"></a>` : h`<div class="order-meta">No screenshot attached.</div>`}</div>
          </div>
          ${p.status === 'rejected' ? h`<p class="order-meta" style="color:var(--danger)">Reason: ${p.reject_reason}</p>` : ''}
          ${p.status !== 'pending' ? h`<p class="order-meta">Reviewed ${dateTime(p.reviewed_at)} by ${nameOf(p.reviewer_id, 'admin')}</p>` : ''}
          ${p.status === 'pending' ? (own ? h`<p class="order-meta">This is your own order, so another admin has to review it.</p>` : ui.rejecting === p.id ? h`
            <form class="review-actions" data-form="reject-proof" data-id="${p.id}"><label for="rp-${p.id}">Reason for the buyer *</label>
              <textarea id="rp-${p.id}" name="reason" rows="2" maxlength="300" placeholder="e.g. No payment with this reference number arrived"></textarea>
              <div class="ord-actions" style="margin-bottom:0"><button type="submit" class="btn btn--sm btn--primary">Reject payment</button><button type="button" class="btn btn--sm btn--ghost" data-act="cancel-ui">Back</button></div></form>` : h`
            <div class="review-actions">
              <label class="review-check"><input type="checkbox" data-check="${p.id}"> I checked Muralla Tech' ${methodLabel(p.method)} account: ${peso(p.amount)} arrived from ${p.sender_name} with reference ${p.reference}.</label>
              <div class="ord-actions" style="margin-bottom:0"><button type="button" class="btn btn--sm btn--primary" data-act="approve-proof" data-id="${p.id}" data-approve disabled ${match ? '' : 'data-nomatch'}>Approve</button>
                <button type="button" class="btn btn--sm btn--ghost" data-act="reject-proof-ask" data-id="${p.id}">Reject</button></div>
            </div>`) : ''}
          ${O.history(o)}
        </article>`;
      }) : h`<div class="empty" style="max-width:420px;margin:30px auto"><p>${f === 'pending' ? 'No payments are waiting for review.' : 'No ' + f + ' payments.'}</p></div>`}`;
  }

  // ---------- payouts ----------
  function payouts() {
    const ds = digitalOrders().filter((o) => o.status !== 'cancelled').sort((a, b) => b.created_at.localeCompare(a.created_at));
    const f = ui.yf;
    const chips = [['pending_release', 'To release'], ['released', 'Released'], ['not_due', 'Not due yet']];
    const shown = ds.filter((o) => o.payment.payout_status === f);
    const sum = (arr, g) => arr.reduce((n, o) => n + g(o), 0);
    return h`<h2 style="margin-bottom:6px">Payout tracking</h2>
      <p class="order-meta" style="margin-bottom:14px">A payout is released only after the order is completed (the buyer confirmed receipt). Platform fee = 5% of the item price; seller payout = item price − fee; the delivery fee is passed on to the seller.</p>
      <div class="kpis kpis--sm">
        <div class="kpi"><small>Fees earned</small><b>${peso(sum(ds.filter((o) => o.status === 'completed'), (o) => o.payment.platform_fee))}</b></div>
        <div class="kpi"><small>To release</small><b>${peso(sum(ds.filter((o) => o.payment.payout_status === 'pending_release'), MF.pay.payoutTransfer))}</b></div>
        <div class="kpi"><small>Released</small><b>${peso(sum(ds.filter((o) => o.payment.payout_status === 'released'), MF.pay.payoutTransfer))}</b></div>
        <div class="kpi"><small>Held, not due</small><b>${peso(sum(ds.filter((o) => o.payment.payout_status === 'not_due' && o.payment.amount_paid != null), (o) => o.payment.amount_paid))}</b></div>
      </div>
      <div class="order-filters" role="group" aria-label="Filter payouts">${chips.map(([k, label]) => h`<button type="button" class="btn btn--sm ${f === k ? 'btn--primary' : 'btn--ghost'}" data-act="yf" data-k="${k}" aria-pressed="${String(f === k)}">${label} (${count(ds, (o) => o.payment.payout_status === k)})</button>`)}</div>
      ${shown.length ? shown.map((o) => {
        const seller = MF.auth.find(o.seller_id);
        const pa = seller && seller.payout_account;
        const own = o.buyer_id === admin.id || o.seller_id === admin.id;
        return h`<article class="ord-card" data-order="${o.order_number}">
          <div class="order-head"><div><b class="order-number">${o.order_number}</b><span class="order-meta">${o.completed_at ? 'Completed ' + dateTime(o.completed_at) : 'Order status: ' + MF.ui.STATUS[o.status][0]} · seller ${nameOf(o.seller_id)}</span></div>${MF.ui.payoutPill(o.payment.payout_status)}</div>
          ${O.payoutBox(o, 'admin')}
          ${pa ? h`<p class="order-meta" style="margin-top:8px">${o.payment.payout_status === 'released' ? 'Sent to' : 'Send to'} <b>${methodLabel(pa.method)} ${pa.account_number}</b> (${pa.account_name})</p>`
            : h`<p class="order-meta" style="margin-top:8px;color:var(--danger)">The seller has not added a payout account yet. They were asked to add one in Settings.</p>`}
          ${o.payment.payout_status === 'pending_release' && pa && !own ? h`<form class="review-actions" data-form="release" data-id="${o.id}"><label for="po-${o.id}">Reference number of the transfer you sent *</label>
            <div class="ord-actions" style="margin-bottom:0"><input id="po-${o.id}" name="reference" type="text" maxlength="40" placeholder="From your transfer receipt"><button type="submit" class="btn btn--sm btn--primary">Mark as released</button></div></form>` : ''}
          ${O.history(o)}
        </article>`;
      }) : h`<div class="empty" style="max-width:420px;margin:30px auto"><p>${f === 'pending_release' ? 'No payouts are waiting to be released.' : f === 'released' ? 'No payouts released yet.' : 'Nothing here.'}</p></div>`}`;
  }

  // ---------- payment details (platform accounts) ----------
  function settingsTab() {
    const s = MF.db.settings();
    return h`<h2 style="margin-bottom:6px">Payment details</h2>
      <p class="order-meta" style="margin-bottom:16px">Buyers who choose GCash or Maya pay into these Muralla Tech accounts and send proof; you approve each one in Payment Confirmation. Demo only: use the placeholder numbers, never real accounts. Switch a method off to hide it at checkout. Platform fee: ${Math.round(s.fee_rate * 100)}% of the item price on digital payments (set in data/settings.json).</p>
      <div class="pay-settings">${['gcash', 'maya'].map((m) => {
        const a = s.platform_accounts[m];
        return h`<form class="co-panel" data-form="account" data-m="${m}" novalidate><h2>${methodLabel(m)}</h2>
          <div class="field"><label for="pa-name-${m}">Account name</label><input id="pa-name-${m}" name="name" maxlength="80" value="${a.account_name}" placeholder="Muralla Tech Demo"></div>
          <div class="field"><label for="pa-number-${m}">${methodLabel(m)} number</label><input id="pa-number-${m}" name="number" inputmode="numeric" maxlength="20" value="${a.account_number}" placeholder="0917 000 0001"></div>
          <div class="field"><label for="pa-qr-${m}">QR code (optional)</label><input id="pa-qr-${m}" type="file" accept="image/*" data-qr="${m}">
            ${a.qr ? h`<div class="pay-settings-qr"><img src="${a.qr}" alt="${methodLabel(m)} QR code"><button type="button" class="btn btn--ghost btn--sm" data-act="rm-qr" data-m="${m}">Remove</button></div>` : ''}</div>
          <label class="review-check"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}> Offer ${methodLabel(m)} at checkout</label>
          <button type="submit" class="btn btn--primary" style="margin-top:12px">Save ${methodLabel(m)}</button></form>`;
      })}</div>`;
  }

  // ---------- activity log ----------
  function log() {
    const ev = MF.db.get('events').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);
    return h`<h2 style="margin-bottom:6px">Activity log</h2><p class="order-meta" style="margin-bottom:14px">Every order status change and payout, with who did it and when (latest 150).</p>
      ${ev.length ? h`<div class="tbl-wrap"><table class="data-table"><thead><tr><th>When</th><th>Order</th><th>Change</th><th>By</th><th>Note</th></tr></thead><tbody>
        ${ev.map((e) => h`<tr><td>${dateTime(e.at)}</td><td>${e.order_number}</td><td>${e.kind === 'payout' ? 'payout ' + e.to : e.kind === 'handover' ? 'handed over' : (e.from ? (MF.ui.STATUS[e.from] || [e.from])[0] + ' → ' : '') + (MF.ui.STATUS[e.to] || [e.to])[0]}</td><td>${e.actor_name} (${e.actor_role})</td><td>${e.note}</td></tr>`)}</tbody></table></div>`
        : h`<div class="empty" style="max-width:420px;margin:30px auto"><p>No activity yet.</p></div>`}`;
  }

  function draw() {
    const pending = count(MF.db.get('proofs'), (p) => p.status === 'pending');
    const toRelease = count(digitalOrders(), (o) => o.payment.payout_status === 'pending_release');
    const pendingL = count(MF.listings.all(), (l) => l.status === 'pending');
    const badge = { listings: pendingL, payments: pending, payouts: toRelease };
    const body = { overview, listings, payments, payouts, settings: settingsTab, log }[ui.tab];
    document.title = 'Admin - Muralla Tech';
    app.innerHTML = h`<div class="wrap section">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><h1 style="margin:0;font-size:1.85rem">Admin Dashboard</h1>
        <span style="background:var(--mango);color:#1a1208;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:.5px">ADMIN CONTROL</span></div>
      <p class="sub" style="color:var(--muted);margin:6px 0 16px">Moderate listings, confirm payments and release payouts.</p>
      ${ui.toast ? MF.ui.notice(ui.toast.kind, ui.toast.text) : ''}
      <div class="tabs" role="tablist" aria-label="Admin sections" style="margin-bottom:20px;border-bottom:1px solid var(--line)">
        ${TABS.map(([k, label]) => h`<button type="button" role="tab" id="tab-${k}" aria-selected="${String(ui.tab === k)}" aria-controls="panel" class="${ui.tab === k ? 'on' : ''}" data-act="go" data-tab="${k}">${label}${badge[k] ? h`<span class="count-badge">${badge[k]}</span>` : ''}</button>`)}
      </div>
      <div id="panel" role="tabpanel" aria-labelledby="tab-${ui.tab}">${body()}</div>
    </div>`;
  }

  MF.ui.wire(app, {
    go: (b, e) => { e.preventDefault(); ui.tab = b.dataset.tab; ui.toast = null; ui.rejecting = ui.deleting = null; history.replaceState(null, '', '#' + ui.tab); draw(); const t = app.querySelector('[role=tab][aria-selected=true]'); if (t) t.focus(); },
    lf: (b) => { ui.lf = b.dataset.k; draw(); },
    pf: (b) => { ui.pf = b.dataset.k; draw(); },
    yf: (b) => { ui.yf = b.dataset.k; draw(); },
    'cancel-ui': () => { ui.rejecting = ui.deleting = null; draw(); },
    'approve-listing': (b) => run(() => MF.listings.moderate(me(), b.dataset.id, 'approved', ''), 'Published. The listing is now live.'),
    'reject-ask': (b) => { ui.rejecting = b.dataset.id; ui.deleting = null; draw(); app.querySelector('textarea').focus(); },
    'del-ask': (b) => { ui.deleting = b.dataset.id; ui.rejecting = null; draw(); },
    'del-yes': (b) => run(() => MF.listings.remove(me(), b.dataset.id), 'Listing deleted.'),
    'approve-proof': (b) => run(() => MF.pay.reviewProof(me(), b.dataset.id, true), 'Payment approved. The buyer and seller were notified.'),
    'reject-proof-ask': (b) => { ui.rejecting = b.dataset.id; draw(); app.querySelector('textarea').focus(); },
    'rm-qr': (b) => { const s = MF.db.settings(); s.platform_accounts[b.dataset.m].qr = null; MF.db.saveSettings(s); draw(); },
  }, {
    'reject-listing': (f) => run(() => MF.listings.moderate(me(), f.dataset.id, 'rejected', f.elements.note.value), 'Listing rejected. The seller was notified.'),
    'reject-proof': (f) => run(() => MF.pay.reviewProof(me(), f.dataset.id, false, f.elements.reason.value), 'Payment rejected. The buyer was notified.'),
    release: (f) => run(() => MF.pay.releasePayout(me(), f.dataset.id, f.elements.reference.value), 'Payout recorded as released. The seller was notified.'),
    account: (f) => {
      const m = f.dataset.m, s = MF.db.settings(), a = s.platform_accounts[m];
      const digits = f.elements.number.value.replace(/\D/g, '');
      const on = f.elements.active.checked;
      if (on && (f.elements.name.value.trim().length < 2 || !/^\d{10,16}$/.test(digits))) { say('error', 'To offer ' + methodLabel(m) + ', enter an account name and a number of 10 to 16 digits.'); draw(); return; }
      Object.assign(a, { account_name: f.elements.name.value.trim(), account_number: digits, active: on });
      MF.db.saveSettings(s);
      say('ok', methodLabel(m) + ' details saved' + (on ? ' and shown at checkout.' : ' (switched off).'));
      draw();
    },
  });

  app.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.check) { const btn = app.querySelector('[data-act="approve-proof"][data-id="' + t.dataset.check + '"]'); btn.disabled = !t.checked || btn.hasAttribute('data-nomatch'); }
    if (t.dataset.qr && t.files[0]) {
      try {
        const s = MF.db.settings();
        s.platform_accounts[t.dataset.qr].qr = await MF.ui.fileToDataUrl(t.files[0], 500, 0.85);
        if (!MF.db.saveSettings(s)) throw new Error('Browser storage is full.');
        say('ok', 'QR code attached. Save is not needed; it is already stored.');
      } catch (err) { say('error', err.message); }
      draw();
    }
  });
  app.addEventListener('input', (e) => {
    if (!e.target.matches('[data-q]')) return;
    ui.q = e.target.value;
    const pos = e.target.selectionStart;
    draw();
    const q = app.querySelector('[data-q]'); q.focus(); q.setSelectionRange(pos, pos);
  });
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.some((x) => x[0] === t)) { ui.tab = t; draw(); } });
  draw();
});
