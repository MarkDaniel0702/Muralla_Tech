/* Cart: [{ id, qty }] in localStorage. Titles and prices are always read from the live listing,
   so a price change or a sold-out item can never be stale in the cart. */
(function () {
  const MF = window.MF;

  const read = () => MF.storage.read('cart', []).filter((i) => i && i.id && i.qty > 0);
  const write = (c) => MF.storage.write('cart', c);
  const count = () => read().reduce((n, i) => n + i.qty, 0);

  function add(listingId, qty) {
    const l = MF.listings.byId(listingId);
    if (!l || l.status !== 'approved' || l.stock < 1) throw new Error('This item is not available.');
    const cart = read();
    const line = cart.find((i) => i.id === listingId);
    if (line) line.qty = Math.min(l.stock, line.qty + qty);
    else cart.push({ id: listingId, qty: Math.min(l.stock, qty) });
    write(cart);
  }
  const setQty = (id, qty) => write(read().map((i) => (i.id === id ? { id, qty } : i)).filter((i) => i.qty > 0));
  const remove = (id) => write(read().filter((i) => i.id !== id));
  const clear = () => write([]);

  // Joins the cart with live listings, drops what is gone and clamps quantities to stock.
  // Returns { lines: [{ listing, qty }], issues: [text] } and saves the corrected cart.
  function resolve() {
    const issues = [];
    const lines = [];
    for (const item of read()) {
      const l = MF.listings.byId(item.id);
      if (!l || l.status !== 'approved' || l.stock < 1) { issues.push('An item in your cart is no longer available and was removed.'); continue; }
      let qty = item.qty;
      if (qty > l.stock) { qty = l.stock; issues.push('Only ' + l.stock + ' of "' + l.title + '" left, so the quantity was lowered.'); }
      lines.push({ listing: l, qty });
    }
    if (issues.length) write(lines.map((x) => ({ id: x.listing.id, qty: x.qty })));
    return { lines, issues };
  }

  // Delivery is charged once per seller (each seller ships their own order); meet-ups are free.
  function totals(lines, delivery) {
    const sellers = new Set(lines.map((x) => x.listing.seller_id)).size;
    const items = lines.reduce((n, x) => n + x.qty, 0);
    const subtotal = lines.reduce((n, x) => n + x.listing.price * x.qty, 0);
    const fee = delivery === 'meetup' ? 0 : MF.db.settings().delivery_fee;
    return { items, sellers, subtotal, delivery: sellers * fee, total: subtotal + sellers * fee };
  }

  MF.cart = { read, count, add, setQty, remove, clear, resolve, totals };
})();
