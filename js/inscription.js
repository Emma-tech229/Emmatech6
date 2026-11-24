import BeniGo from './store.js';
(function () {
  var form = document.getElementById('signupForm');
  var box = document.getElementById('formError');
  var submit = form.querySelector('button[type="submit"]');

  BeniGo.me().then(function (user) {
    if (user) window.location.replace('annonces.html');
  });

  function fail(message) {
    box.textContent = message;
    box.hidden = false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    box.hidden = true;

    var password = document.getElementById('password').value;
    var confirm = document.getElementById('confirm').value;
    if (password !== confirm) {
      fail('Les deux mots de passe ne correspondent pas.');
      return;
    }

    submit.disabled = true;
    BeniGo.signup({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      password: password
    }).then(function () {
      window.location.href = 'annonces.html';
    }, function (error) {
      submit.disabled = false;
      fail(error.message);
    });
  });
})();
