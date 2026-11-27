import BeniGo from './store.js';

(function () {
  var params = new URLSearchParams(window.location.search);
  var listingId = params.get('id') || '';
  var errorBox = document.getElementById('error');
  var orderBtn = document.getElementById('orderBtn');
  var form = document.getElementById('orderForm');
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
      fail('Vous ne pouvez pas commander votre propre annonce.');
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

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!listing) return;
    errorBox.hidden = true;

    var delivery = document.querySelector('input[name="delivery"]:checked').value;
    var address = document.getElementById('address').value;

    if (delivery === 'livreur' && address.trim().length < 6) {
      fail('Indiquez une adresse de livraison.');
      return;
    }

    orderBtn.disabled = true;
    orderBtn.textContent = 'Enregistrement.';

    BeniGo.createOrder({
      listingId: listing.id,
      delivery: delivery,
      relay: delivery === 'relais' ? document.getElementById('relay').value : '',
      address: delivery === 'livreur' ? address : '',
      phone: document.getElementById('phone').value || user.phone || ''
    }).then(function (data) {
      window.location.href = 'commande.html?ref=' + encodeURIComponent(data.ref);
    }).catch(function (error) {
      orderBtn.disabled = false;
      orderBtn.textContent = 'Enregistrer ma commande';
      fail(error.message);
    });
  });
})();
