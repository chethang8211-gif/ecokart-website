// auth-guard.js - gate every page behind login.
// Load this FIRST, in <head>, on every page except login.html / signup.html.
(function () {
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var PUBLIC = ['login.html', 'signup.html'];

  var token = null;
  try { token = localStorage.getItem('token'); } catch (e) {}

  // Not logged in and this page is not public -> straight to login.
  if (PUBLIC.indexOf(page) === -1 && !token) {
    location.replace('login.html');
    return;
  }

  function logout() {
    try { localStorage.removeItem('token'); } catch (e) {}
    location.replace('login.html');
  }

  // Shared helpers for the rest of the app.
  window.AUTH = {
    token: token,
    // Merge the Bearer header into an existing headers object.
    headers: function (extra) {
      var h = extra || {};
      if (token) h['Authorization'] = 'Bearer ' + token;
      return h;
    },
    // Call on every fetch response; bounces to login on 401.
    check: function (res) {
      if (res && res.status === 401) { logout(); throw new Error('unauthorized'); }
      return res;
    },
    logout: logout
  };

  // Turn the "Login" nav link into "Logout" once authenticated.
  document.addEventListener('DOMContentLoaded', function () {
    if (!token) return;
    var link = document.querySelector('a.tb-link[href="login.html"]');
    if (link) {
      link.textContent = '🚪 Logout';
      link.setAttribute('href', '#');
      link.addEventListener('click', function (e) { e.preventDefault(); logout(); });
    }
  });
})();
