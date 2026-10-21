/* Listings: search / filter / sort, creating, moderation, saved items. Electronics is the only category. */
(function () {
  const MF = window.MF;

  const CATEGORY = 'Electronics';
  const CONDITIONS = ['Brand New', 'Like New', 'Lightly Used', 'Well Loved'];
  const MAX_PHOTOS = 5;
  const SORTS = ['newest', 'price-asc', 'price-desc'];

  const all = () => MF.db.get('listings');
  const byId = (id) => all().find((l) => l.id === id) || null;
  const approved = () => all().filter((l) => l.status === 'approved');
  const has = (hay, needle) => String(hay || '').toLowerCase().includes(String(needle).toLowerCase());

  // q, type, cond, min, max, brand, size, mat, seller, sort -> approved listings, in order
  function search(f) {
    let list = approved().filter((l) =>
      (!f.q || has(l.title, f.q) || has(l.brand, f.q)) &&
      (!f.type || l.type === f.type) &&
      (!f.cond || l.condition === f.cond) &&
      (f.min === '' || f.min == null || !Number.isFinite(Number(f.min)) || l.price >= Number(f.min)) &&
      (f.max === '' || f.max == null || !Number.isFinite(Number(f.max)) || l.price <= Number(f.max)) &&
      (!f.brand || has(l.brand, f.brand)) &&
      (!f.size || has(l.size, f.size)) &&
      (!f.mat || has(l.material_color, f.mat)) &&
      (!f.seller || l.seller_id === f.seller));
    const sort = SORTS.includes(f.sort) ? f.sort : 'newest';
    list.sort((a, b) => (sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : b.created_at.localeCompare(a.created_at)));
    return list;
  }

  // Creates a listing. Admins publish at once; sellers go to the moderation queue.
  function create(user, f) {
    if (!['seller', 'admin'].includes(user.role)) throw new Error('Only seller accounts can list items.');
    const price = Number(f.price);
    const stock = Math.floor(Number(f.stock) || 1);
    if (!f.title.trim()) throw new Error('Title is required.');
    if (!(price > 0)) throw new Error('Price must be greater than 0.');
    if (!f.description.trim()) throw new Error('Please describe the item: condition details, flaws, reason for selling.');
    if (!f.brand.trim() || !f.size.trim() || !f.material_color.trim()) throw new Error('Brand, size / dimensions and material / color are required. Write "Unbranded" or "N/A" where they do not apply.');
    if (!CONDITIONS.includes(f.condition)) throw new Error('Choose a condition.');
    if (stock < 1) throw new Error('Stock must be at least 1.');
    if (f.photos.length > MAX_PHOTOS) throw new Error('A listing can have at most ' + MAX_PHOTOS + ' photos.');
    const listing = {
      id: MF.uid('l'), title: f.title.trim(), category: CATEGORY, brand: f.brand.trim(), condition: f.condition, price,
      size: f.size.trim(), material_color: f.material_color.trim(), location: (f.location || '').trim() || 'Metro Manila',
      description: f.description.trim(), stock, type: f.type === 'surplus' ? 'surplus' : 'preloved',
      can_ship: !!f.can_ship, can_meetup: !!f.can_meetup, seller_id: user.id,
      status: user.role === 'admin' ? 'approved' : 'pending', admin_note: '', created_at: MF.now(), photos: f.photos, photo_credits: [],
    };
    const list = all();
    list.push(listing);
    if (!MF.db.save('listings', list)) throw new Error('Your browser storage is full, so the listing was not saved. Remove a photo or use "Reset demo data" in the footer.');
    return listing;
  }

  // Seller edits price / stock of an own listing (admin: any). Not re-moderated: demo simplification.
  function edit(user, id, { price, stock }) {
    const list = all();
    const l = list.find((x) => x.id === id);
    if (!l || (l.seller_id !== user.id && user.role !== 'admin')) throw new Error('You can only change your own listings.');
    if (!(Number(price) > 0)) throw new Error('Price must be greater than 0.');
    if (!(Math.floor(Number(stock)) >= 0)) throw new Error('Stock cannot be negative.');
    l.price = Number(price);
    l.stock = Math.floor(Number(stock));
    MF.db.save('listings', list);
    return l;
  }

  function remove(user, id) {
    const l = byId(id);
    if (!l || (l.seller_id !== user.id && user.role !== 'admin')) throw new Error('You can only remove your own listings.');
    MF.db.save('listings', all().filter((x) => x.id !== id));
  }

  // Admin moderation: approve / reject (with an optional note) a listing.
  function moderate(admin, id, status, note) {
    if (admin.role !== 'admin') throw new Error('Only admins can review listings.');
    if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('Unknown status.');
    if (status === 'rejected' && !String(note || '').trim()) throw new Error('Give the seller a reason for rejecting the listing.');
    const list = all();
    const l = list.find((x) => x.id === id);
    if (!l) throw new Error('Listing not found.');
    l.status = status;
    l.admin_note = String(note || '').trim();
    MF.db.save('listings', list);
    MF.pay.notify(l.seller_id, status === 'approved' ? 'Listing published' : 'Listing rejected',
      status === 'approved' ? '"' + l.title + '" is now live.' : '"' + l.title + '" was rejected: ' + l.admin_note, 'orders.html?tab=listings');
    return l;
  }

  // saved items (favorites) are ids kept in this browser
  const saved = () => MF.storage.read('saved', []);
  const isSaved = (id) => saved().includes(id);
  function toggleSaved(id) {
    const s = saved();
    const next = s.includes(id) ? s.filter((x) => x !== id) : s.concat(id);
    MF.storage.write('saved', next);
    return next.includes(id);
  }

  const photoOf = (l) => (l.photos && l.photos[0]) || 'assets/placeholder.svg';

  MF.listings = { CATEGORY, CONDITIONS, MAX_PHOTOS, SORTS, all, byId, approved, search, create, edit, remove, moderate, saved, isSaved, toggleSaved, photoOf };
})();
