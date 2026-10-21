/* App state. Everything lives in localStorage under the "mf2_" prefix; data/*.json (or data/seed.js when the page is
   opened straight from disk) only provides the first-run seed. Classic scripts, no modules: ES modules cannot load
   from file:// in Chrome, and "open index.html" must work. */
(function () {
  const MF = (window.MF = window.MF || {});
  const PREFIX = 'mf2_';
  const SEED_VERSION = '2';   // bumped when data/*.json changes so existing browsers pick up the new listings
  const mem = {}; // used when localStorage is blocked (private mode): works for this tab only

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return key in mem ? mem[key] : fallback;
    }
  };
  // Returns false when the browser refuses (quota); callers that store photos check it.
  const write = (key, value) => {
    mem[key] = value;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  };
  const remove = (key) => { delete mem[key]; try { localStorage.removeItem(PREFIX + key); } catch (e) { /* nothing stored */ } };

  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const now = () => new Date().toISOString();

  // Same collection names as the seed/JSON files, plus the ones that start empty.
  const COLLECTIONS = { users: [], listings: [], orders: [], proofs: [], events: [], notes: [] };

  const db = {
    get: (name) => read(name, COLLECTIONS[name] ? COLLECTIONS[name].slice() : []),
    save: (name, value) => write(name, value),
    settings: () => read('settings', {}),
    saveSettings: (s) => write('settings', s),
    session: () => read('session', null),
    setSession: (id) => (id ? write('session', id) : remove('session')),
    // Order numbers: MF-260001, MF-260002 ...
    nextOrderNumber: () => {
      const n = read('order_seq', 0) + 1;
      write('order_seq', n);
      return 'MF-26' + String(n).padStart(4, '0');
    },
    reset: () => {
      Object.keys(localStorage).filter((k) => k.indexOf(PREFIX) === 0 && k !== PREFIX + 'theme').forEach((k) => localStorage.removeItem(k));
      Object.keys(mem).forEach((k) => delete mem[k]);
    },
  };

  async function loadSeed(root) {
    try {
      const names = ['listings', 'users', 'settings'];
      const parts = await Promise.all(names.map((n) => fetch(root + 'data/' + n + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })));
      return { listings: parts[0], users: parts[1], settings: parts[2] };
    } catch (e) {
      if (window.MF_SEED) return window.MF_SEED; // opened from disk: fetch() of local files is blocked
      throw e;
    }
  }

  // Resolves once the first-run seed is in localStorage. Every page waits for it before drawing.
  MF.ready = (async function () {
    const root = document.body.getAttribute('data-root') || '';
    MF.root = root;
    if (read('seed_version', null) !== SEED_VERSION) {
      const seed = await loadSeed(root);
      write('listings', seed.listings);
      write('users', seed.users);
      write('settings', seed.settings);
      write('seed_version', SEED_VERSION);
    }
  })();

  MF.db = db;
  MF.uid = uid;
  MF.now = now;
  MF.storage = { read, write, remove };
})();
