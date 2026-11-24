import BeniGo from './store.js';
(function () {
  BeniGo.me().then(function (user) {
    if (!user) return;

    var account = document.getElementById('navAccount');
    var cta = document.getElementById('navCta');
    if (account) {
      account.textContent = 'Mon profil';
      account.href = 'profil.html';
    }
    if (cta) {
      cta.textContent = 'Publier une annonce';
      cta.href = 'publier.html';
    }

    var actions = document.querySelector('.hero-copy .row');
    if (actions) {
      var first = actions.querySelector('.btn:not(.ghost)');
      if (first) {
        first.textContent = 'Publier une annonce';
        first.href = 'publier.html';
      }
    }
  });
})();
