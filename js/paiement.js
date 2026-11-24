import BeniGo from './store.js';
(function () {
  var params = new URLSearchParams(window.location.search);
  var listingId = params.get('id') || '';
  var errorBox = document.getElementById('error');
  var payBtn = document.getElementById('payBtn');
  var user = null;
  var listing = null;

  function fail(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  BeniGo.requireUser('connexion.html').then(function (account) {
    user = account;
    if (!user) return null;
    return BeniGo.listing(listingId);
  }).then(function (result) {
    if (!user) return;
    if (!result) {
      fail('Annonce introuvable. Retournez a la liste des annonces.');
      return;
    }
    listing = result;
    if (listing.sellerId === user.id) {
      fail('Vous ne pouvez pas acheter votre propre annonce.');
      return;
    }
    if (listing.status !== 'active') {
      fail('Cet article est deja reserve par un autre acheteur.');
      return;
    }
    render();
  }).catch(function (error) {
    fail(error.message);
  });

  function render() {
    document.getElementById('checkoutGrid').hidden = false;
    document.getElementById('summaryTitle').textContent = listing.title;
    document.getElementById('summarySeller').textContent = 'Vendeur : ' + listing.sellerName;
    document.getElementById('linePrice').textContent = BeniGo.money(listing.price);
    document.getElementById('total').textContent = BeniGo.money(listing.price);

    var thumb = document.getElementById('thumb');
    if (listing.images && listing.images[0]) {
      var img = document.createElement('img');
      img.src = listing.images[0];
      img.alt = listing.title;
      thumb.appendChild(img);
    }

    var relaySelect = document.getElementById('relay');
    BeniGo.RELAYS.forEach(function (relay) {
      var option = document.createElement('option');
      option.value = relay.name;
      option.textContent = relay.name + ' - ' + relay.detail;
      relaySelect.appendChild(option);
    });

    var relayField = document.getElementById('relayField');
    var deliveryField = document.getElementById('deliveryField');
    document.getElementById('phone').value = user.phone || '';

    Array.prototype.forEach.call(document.querySelectorAll('input[name="delivery"]'), function (radio) {
      radio.addEventListener('change', function () {
        var isRelay = document.querySelector('input[name="delivery"]:checked').value === 'relais';
        relayField.hidden = !isRelay;
        deliveryField.hidden = isRelay;
      });
    });
  }

  document.getElementById('payForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!listing) return;
    errorBox.hidden = true;
    payBtn.disabled = true;

    var delivery = document.querySelector('input[name="delivery"]:checked').value;
    var relay = document.getElementById('relay').value;

    BeniGo.createOrder({
      listingId: listing.id,
      delivery: delivery,
      relay: relay,
      address: document.getElementById('address').value
    }).then(function (order) {
      window.location.href = 'commande.html?ref=' + encodeURIComponent(order.ref);
    }, function (error) {
      payBtn.disabled = false;
      fail(error.message);
    });
  });
})();
