/* Logic check for the payment module (no browser, no install): node tools/test_payment.js
   Loads the real js/*.js files against a fake localStorage and walks every order / payment status path. */
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');

const store = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
});
globalThis.window = globalThis;
globalThis.document = { body: { getAttribute: () => '' } };
globalThis.fetch = () => Promise.reject(new Error('no fetch in node: the seed.js fallback is used'));
['data/seed.js', 'js/store.js', 'js/ui.js', 'js/auth.js', 'js/listings.js', 'js/cart.js', 'js/payment.js'].forEach((f) => require(path.join(root, f)));
const MF = globalThis.MF;

const throws = (fn, re, what) => assert.throws(fn, re, what);
const user = (id) => MF.auth.find(id);
let buyer, seller, seller2, admin; // looked up once the seed is in place
const lines = (...ids) => ids.map((id) => ({ listing: MF.listings.byId(id), qty: 1 }));
const details = (o) => Object.assign({ delivery: 'standard', method: 'gcash', first_name: 'Bea', last_name: 'Santos', phone: '0917 123 4567', address: '1 Rizal St, Manila', notes: '' }, o);
const proof = (o, ref, extra) => Object.assign({ method: 'gcash', sender_name: 'Bea Santos', reference: ref, amount: o.total }, extra);
const get = (o) => MF.pay.byId(o.id);

(async () => {
  await MF.ready;
  buyer = user('u_buyer'); seller = user('u_seller1'); seller2 = user('u_seller2'); admin = user('u_admin');

  // --- fee math: 5% of the item price, digital only ---
  const [a] = MF.pay.placeOrder(buyer, lines('e01'), details());           // iPhone SE, 9800
  assert.strictEqual(a.subtotal, 9800);
  assert.strictEqual(a.total, 9880);                                       // + 80 delivery
  assert.strictEqual(a.payment.platform_fee, 490);
  assert.strictEqual(a.payment.seller_payout, 9310);
  assert.strictEqual(MF.pay.payoutTransfer(a), 9390);                      // payout + delivery fee passed to the seller
  assert.strictEqual(a.status, 'awaiting_payment');
  assert.strictEqual(a.payment.payout_status, 'not_due');
  assert.strictEqual(MF.listings.byId('e01').stock, 0, 'stock is reserved');

  // --- validation: wrong amount, short reference, someone else's order ---
  throws(() => MF.pay.submitProof(buyer, a.id, proof(a, 'GC123456', { amount: 9800 })), /exactly/);
  throws(() => MF.pay.submitProof(buyer, a.id, proof(a, 'AB1')), /reference number/);
  throws(() => MF.pay.submitProof(buyer, a.id, proof(a, 'GC123456', { sender_name: ' ' })), /name/);
  throws(() => MF.pay.submitProof(seller, a.id, proof(a, 'GC123456')), /not yours/);
  MF.pay.submitProof(buyer, a.id, proof(a, 'gc-123 456'));                // normalised to GC123456
  assert.strictEqual(get(a).status, 'payment_submitted');
  assert.strictEqual(MF.pay.proofsOf(a.id)[0].reference, 'GC123456');
  throws(() => MF.pay.submitProof(buyer, a.id, proof(a, 'GC123457')), /not waiting/);

  // --- duplicate reference across orders is rejected ---
  const [b] = MF.pay.placeOrder(buyer, lines('e02'), details({ method: 'maya' }));
  throws(() => MF.pay.submitProof(buyer, b.id, proof(b, 'GC123456', { method: 'maya' })), /already used/);

  // --- roles: only an admin confirms; sellers and buyers cannot ---
  const pid = MF.pay.proofsOf(a.id)[0].id;
  throws(() => MF.pay.reviewProof(buyer, pid, true), /admins/);
  throws(() => MF.pay.reviewProof(seller, pid, true), /admins/);
  throws(() => MF.pay.markHandedOver(seller, a.id), /payment is confirmed/);
  MF.pay.reviewProof(admin, pid, true);
  assert.strictEqual(get(a).status, 'payment_confirmed');
  assert.strictEqual(get(a).payment.amount_paid, 9880);
  throws(() => MF.pay.reviewProof(admin, pid, true), /already reviewed/);

  // --- hand over -> receipt -> payout; each step is guarded ---
  throws(() => MF.pay.confirmReceived(buyer, a.id), /not marked/);
  throws(() => MF.pay.releasePayout(admin, a.id, 'PAYOUT0001'), /after the order is completed/);
  throws(() => MF.pay.markHandedOver(seller2, a.id), /not your order/);
  MF.pay.markHandedOver(seller, a.id);
  throws(() => MF.pay.confirmReceived(seller, a.id), /not your order/);
  MF.pay.confirmReceived(buyer, a.id);
  assert.strictEqual(get(a).status, 'completed');
  assert.strictEqual(get(a).payment.payout_status, 'pending_release');
  throws(() => MF.pay.releasePayout(seller, a.id, 'PAYOUT0001'), /admins/);
  throws(() => MF.pay.releasePayout(admin, a.id, 'x'), /reference/);
  MF.pay.releasePayout(admin, a.id, 'payout 0001');
  assert.strictEqual(get(a).payment.payout_status, 'released');
  assert.strictEqual(get(a).payment.payout_reference, 'PAYOUT0001');
  throws(() => MF.pay.releasePayout(admin, a.id, 'PAYOUT0002'), /not waiting/);

  // --- rejected path: reason required, reference freed, 3 attempts max, no cancel while under review ---
  throws(() => MF.pay.cancelOrder(buyer, b.id + 'x'), /not your order/);
  MF.pay.submitProof(buyer, b.id, proof(b, 'MY000001', { method: 'maya' }));
  throws(() => MF.pay.cancelOrder(buyer, b.id, 'oops'), /no longer be cancelled/);
  let p = MF.pay.proofsOf(b.id)[0];
  throws(() => MF.pay.reviewProof(admin, p.id, false, ''), /reason/);
  MF.pay.reviewProof(admin, p.id, false, 'Sender name does not match');
  assert.strictEqual(get(b).status, 'payment_rejected');
  assert.strictEqual(get(b).payment.payout_status, 'not_due');
  MF.pay.submitProof(buyer, b.id, proof(b, 'MY000001', { method: 'maya' }));   // a rejected reference can be reused
  MF.pay.reviewProof(admin, MF.pay.proofsOf(b.id)[1].id, false, 'Amount not received');
  MF.pay.submitProof(buyer, b.id, proof(b, 'MY000003', { method: 'maya' }));
  MF.pay.reviewProof(admin, MF.pay.proofsOf(b.id)[2].id, false, 'Fake receipt');
  throws(() => MF.pay.submitProof(buyer, b.id, proof(b, 'MY000004', { method: 'maya' })), /No attempts are left/);
  MF.pay.cancelOrder(buyer, b.id, 'Giving up');                                // allowed: no money is held
  assert.strictEqual(get(b).status, 'cancelled');
  assert.strictEqual(MF.listings.byId('e02').stock, 1, 'cancelled order returns the stock');

  // --- meet-up: no payment record, no proof, no fee, no payout ---
  const [m] = MF.pay.placeOrder(buyer, lines('e03'), details({ delivery: 'meetup', method: undefined }));
  assert.strictEqual(m.payment, null);
  assert.strictEqual(m.delivery_fee, 0);
  assert.strictEqual(m.payment_method, 'meetup');
  assert.strictEqual(m.status, 'pending');
  throws(() => MF.pay.submitProof(buyer, m.id, proof(m, 'MEET0001')), /no proof to send/);
  throws(() => MF.pay.markHandedOver(seller, m.id), /Confirm the order first/);
  MF.pay.confirmMeetup(seller, m.id);
  MF.pay.markHandedOver(seller, m.id);
  assert.strictEqual(get(m).status, 'completed');
  throws(() => MF.pay.releasePayout(admin, m.id, 'MEET00001'), /Order not found/);

  // --- seller cancel (digital, before payment) and own-listing / stock guards ---
  const [c] = MF.pay.placeOrder(buyer, lines('e04'), details());
  MF.pay.cancelOrder(seller, c.id, 'Sold elsewhere');
  assert.strictEqual(get(c).cancelled_by, 'seller');
  throws(() => MF.pay.placeOrder(seller, lines('e05'), details()), /own listing/);
  throws(() => MF.pay.placeOrder(buyer, lines('e01'), details()), /Only 0 of|no longer/);   // e01 is sold out
  throws(() => MF.pay.placeOrder(buyer, lines('e04'), details({ method: 'paypal' })), /GCash or Maya/);
  throws(() => MF.pay.placeOrder(buyer, lines('e04'), details({ phone: '12' })), /phone/);

  // --- a cart with two sellers makes two orders; the second seller has no payout account yet ---
  const two = MF.pay.placeOrder(buyer, lines('e04', 'e17'), details());       // seller1 + seller2
  assert.strictEqual(two.length, 2);
  const o2 = two.find((o) => o.seller_id === 'u_seller2');
  MF.pay.submitProof(buyer, o2.id, proof(o2, 'TWO000001'));
  MF.pay.reviewProof(admin, MF.pay.proofsOf(o2.id)[0].id, true);
  MF.pay.markHandedOver(seller2, o2.id);
  MF.pay.confirmReceived(buyer, o2.id);
  throws(() => MF.pay.releasePayout(admin, o2.id, 'TWOPAYOUT1'), /payout account/);
  MF.auth.savePayoutAccount(seller2, { method: 'maya', account_name: 'Lena Reyes', account_number: '09181234567' });
  MF.pay.releasePayout(admin, o2.id, 'TWOPAYOUT1');

  // --- the log: every status change has an actor and a time ---
  const events = MF.db.get('events');
  assert.ok(events.length > 20);
  assert.ok(events.every((e) => e.actor_id && e.actor_role && e.at && e.order_number));
  const trail = MF.pay.eventsFor(a.id).map((e) => e.actor_role + ':' + (e.to));
  assert.deepStrictEqual(trail, ['buyer:awaiting_payment', 'buyer:payment_submitted', 'admin:payment_confirmed', 'seller:payment_confirmed', 'buyer:completed', 'admin:released']);

  // --- listings: admin publishes at once, seller waits for review; only admins moderate ---
  const base = { title: 'Test', price: '100', description: 'd', brand: 'b', size: 's', material_color: 'm', condition: 'Like New', photos: [], stock: 1 };
  assert.strictEqual(MF.listings.create(admin, base).status, 'approved');
  const pend = MF.listings.create(seller, base);
  assert.strictEqual(pend.status, 'pending');
  throws(() => MF.listings.moderate(seller, pend.id, 'approved', ''), /admins/);
  throws(() => MF.listings.moderate(admin, pend.id, 'rejected', ''), /reason/);
  MF.listings.moderate(admin, pend.id, 'approved', '');
  throws(() => MF.listings.create(buyer, base), /seller accounts/);
  throws(() => MF.listings.create(seller, Object.assign({}, base, { photos: new Array(6).fill('x') })), /at most 5/);
  throws(() => MF.listings.create(seller, Object.assign({}, base, { brand: '' })), /required/);
  throws(() => MF.listings.remove(buyer, pend.id), /own listings/);

  console.log('payment module: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
