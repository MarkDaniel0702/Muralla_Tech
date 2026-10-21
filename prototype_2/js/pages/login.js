/* Log in / Sign up (one page, two tabs). Demo accounts can be filled in with one click. */
MF.ui.boot(function () {
  const { h, icon, page } = MF.ui;
  const app = document.getElementById('app');
  const params = MF.ui.params();
  let mode = params.get('mode') === 'signup' || location.hash === '#signup' ? 'signup' : 'login';
  let role = 'buyer';
  let error = '';

  // Only same-site relative pages are allowed as a "next" target (no open redirect).
  const safeNext = (n) => (/^(pages\/)?[a-z-]+\.html(\?[\w=&%.-]*)?(#[\w-]*)?$/.test(n || '') ? n : '');
  function done(user) {
    const next = safeNext(params.get('next'));
    location.href = MF.root + (next || (user.role === 'admin' ? 'pages/admin.html' : 'index.html'));
  }

  const DEMOS = [['Buyer', 'buyer@manilafinds.test', 'buyer123'], ['Seller', 'seller@manilafinds.test', 'seller123'], ['Admin', 'admin@manilafinds.test', 'admin123']];

  function draw() {
    document.title = (mode === 'login' ? 'Log in' : 'Sign up') + ' - ManilaFinds';
    app.innerHTML = h`
    <div class="auth-wrap"><div class="auth-card">
      <div class="auth-brand"><div class="sunburst"></div>
        <img src="${MF.root}assets/icon.png" alt="" width="48" height="48">
        <h2>Palengke meets premium.</h2>
        <ul>
          <li>${icon('check', 16)} Pay by GCash or Maya, protected until you receive the item</li>
          <li>${icon('check', 16)} Prefer cash? Meet up and pay the seller directly</li>
          <li>${icon('check', 16)} Every listing is reviewed before it goes live</li>
        </ul>
        <p class="quote">Prototype 2: demo data lives in this browser only. No real payments.</p>
      </div>
      <div class="auth-form">
        <div class="tabs" role="tablist" aria-label="Log in or sign up">
          <button type="button" role="tab" id="tab-login" aria-selected="${String(mode === 'login')}" class="${mode === 'login' ? 'on' : ''}" data-act="mode" data-mode="login">Log in</button>
          <button type="button" role="tab" id="tab-signup" aria-selected="${String(mode === 'signup')}" class="${mode === 'signup' ? 'on' : ''}" data-act="mode" data-mode="signup">Sign up</button>
        </div>
        <form data-form="${mode}" novalidate aria-labelledby="tab-${mode}">
          ${error ? MF.ui.notice('error', error) : ''}
          ${mode === 'signup' ? h`
            <div class="field-row">
              <div class="field"><label for="au-first">First name</label><input id="au-first" name="first_name" autocomplete="given-name" required></div>
              <div class="field"><label for="au-last">Last name</label><input id="au-last" name="last_name" autocomplete="family-name" required></div>
            </div>
            <div class="field"><label id="au-role-l">I want to…</label>
              <div class="segmented" role="radiogroup" aria-labelledby="au-role-l" style="margin-top:6px">
                <button type="button" role="radio" aria-checked="${String(role === 'buyer')}" class="${role === 'buyer' ? 'on' : ''}" data-act="role" data-role="buyer">Buy things</button>
                <button type="button" role="radio" aria-checked="${String(role === 'seller')}" class="${role === 'seller' ? 'on' : ''}" data-act="role" data-role="seller">Sell things</button>
              </div></div>` : ''}
          <div class="field"><label for="au-email">Email address</label><input id="au-email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="au-pass">Password</label><input id="au-pass" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required></div>
          <button type="submit" class="btn btn--primary btn--block btn--lg">${mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        ${mode === 'login' ? h`<div class="demo-accts"><small>Demo accounts (click to fill)</small>
          ${DEMOS.map(([label, email, pw]) => h`<button type="button" data-act="demo" data-email="${email}" data-pw="${pw}">${label}<span>${email}</span></button>`)}</div>` : ''}
      </div>
    </div></div>`;
  }

  MF.ui.wire(app, {
    mode: (b) => { mode = b.dataset.mode; error = ''; draw(); app.querySelector('input').focus(); },
    role: (b) => { role = b.dataset.role; app.querySelectorAll('[data-act="role"]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); },
    demo: (b) => { app.querySelector('[name=email]').value = b.dataset.email; app.querySelector('[name=password]').value = b.dataset.pw; app.querySelector('button[type=submit]').focus(); },
  }, {
    login: (f) => {
      try { done(MF.auth.login(f.elements.email.value, f.elements.password.value)); } catch (e) { error = e.message; draw(); app.querySelector('[name=email]').focus(); }
    },
    signup: (f) => {
      try { done(MF.auth.signup({ first_name: f.elements.first_name.value, last_name: f.elements.last_name.value, email: f.elements.email.value, password: f.elements.password.value, role })); }
      catch (e) { error = e.message; draw(); }
    },
  });
  draw();
});
