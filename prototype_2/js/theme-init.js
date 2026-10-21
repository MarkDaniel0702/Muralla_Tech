/* Runs in <head> before first paint so there is no light/dark flash. */
try {
  var t = localStorage.getItem('mf2_theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: the OS setting applies */ }
