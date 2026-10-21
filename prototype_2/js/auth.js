/* Accounts and roles (buyer / seller / admin). Mock only: passwords sit in plain text in localStorage,
   which is fine for a demo and would never be acceptable for a real site. */
(function () {
  const MF = window.MF;
  const { h } = MF.ui;

  const find = (id) => MF.db.get('users').find((u) => u.id === id) || null;
  const current = () => { const id = MF.db.session(); return id ? find(id) : null; };

  function login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const user = MF.db.get('users').find((u) => u.email.toLowerCase() === e && u.password === password);
    if (!user) throw new Error('Wrong email or password.');
    MF.db.setSession(user.id);
    return user;
  }

  // Sign-up can create buyers and sellers only: admin cannot be self-selected.
  function signup({ first_name, last_name, email, password, role }) {
    const e = String(email || '').trim().toLowerCase();
    if (!first_name.trim() || !last_name.trim()) throw new Error('Enter your first and last name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Enter a valid email address.');
    if (String(password || '').length < 6) throw new Error('Use a password of at least 6 characters.');
    if (!['buyer', 'seller'].includes(role)) throw new Error('Choose buyer or seller.');
    const users = MF.db.get('users');
    if (users.some((u) => u.email.toLowerCase() === e)) throw new Error('That email already has an account. Log in instead.');
    const user = { id: MF.uid('u'), role, email: e, password, first_name: first_name.trim(), last_name: last_name.trim(), created_at: MF.now(), payout_account: null };
    users.push(user);
    MF.db.save('users', users);
    MF.db.setSession(user.id);
    return user;
  }

  const logout = () => MF.db.setSession(null);

  function update(userId, changes) {
    const users = MF.db.get('users');
    const u = users.find((x) => x.id === userId);
    Object.assign(u, changes);
    MF.db.save('users', users);
    return u;
  }

  function savePayoutAccount(user, { method, account_name, account_number }) {
    const digits = String(account_number || '').replace(/\D/g, '');
    if (!['gcash', 'maya'].includes(method)) throw new Error('Choose GCash or Maya.');
    if (String(account_name || '').trim().length < 2) throw new Error('Enter the account name.');
    if (!/^\d{10,16}$/.test(digits)) throw new Error('Enter the account number (10 to 16 digits), e.g. 0917 123 4567.');
    return update(user.id, { payout_account: { method, account_name: account_name.trim(), account_number: digits } });
  }

  // Page guard. Returns the user when allowed; otherwise draws a sign-in or access-denied panel and returns null.
  // The same rules are enforced again inside js/payment.js and js/listings.js, so hiding a page is never the only protection.
  function require(roles) {
    const user = current();
    const app = document.getElementById('app');
    if (user && (!roles || roles.includes(user.role))) return user;
    app.innerHTML = user
      ? h`<div class="wrap section"><div class="empty" style="max-width:480px;margin:40px auto" role="alert">
          <h3>Access denied</h3><p>This page is only for ${roles.join(' / ')} accounts. You are signed in as ${user.role}.</p>
          <a class="btn btn--primary" style="margin-top:14px" href="${MF.ui.page('index')}">Back to home</a></div></div>`
      : h`<div class="wrap section"><div class="empty" style="max-width:480px;margin:40px auto">
          <h3>Please log in</h3><p>You need to be signed in to see this page.</p>
          <a class="btn btn--primary" style="margin-top:14px" href="${MF.ui.page('login')}?next=${encodeURIComponent(MF.ui.here())}">Log In / Sign Up</a></div></div>`;
    return null;
  }

  MF.auth = { find, current, login, signup, logout, update, savePayoutAccount, require };
})();
