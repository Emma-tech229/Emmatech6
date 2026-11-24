import BeniGo from './store.js';
(function () {
  var form = document.getElementById('loginForm');
  var box = document.getElementById('formError');

  BeniGo.me().then(function (user) {
    if (user) window.location.replace('annonces.html');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    box.hidden = true;

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    BeniGo.login(
      document.getElementById('identifier').value,
      document.getElementById('password').value
    ).then(function () {
      window.location.href = 'annonces.html';
    }, function (error) {
      button.disabled = false;
      box.textContent = error.message;
      box.hidden = false;
    });
  });
})();
