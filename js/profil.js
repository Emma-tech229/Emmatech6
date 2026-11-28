import BeniGo from './store.js';
(function () {
  var themes = document.getElementById('themes');

  function renderThemes() {
    themes.innerHTML = '';
    var active = BeniGoTheme.get();
    BeniGoTheme.THEMES.forEach(function (name) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-btn' + (name === active ? ' on' : '');
      var swatch = document.createElement('span');
      swatch.className = 'swatch ' + name;
      button.appendChild(swatch);
      var label = document.createElement('span');
      label.textContent = BeniGoTheme.LABELS[name];
      button.appendChild(label);
      button.addEventListener('click', function () {
        BeniGoTheme.set(name);
        renderThemes();
      });
      themes.appendChild(button);
    });
  }
  renderThemes();

  var user = null;

  BeniGo.requireUser('connexion.html').then(function (account) {
    user = account;
    if (!user) return null;

    document.getElementById('userName').textContent = user.name;
    document.getElementById('userContact').textContent =
      user.email + ' - ' + user.phone + ' - membre depuis ' + BeniGo.dateLabel(user.createdAt);

    renderSubscription(user);

    return Promise.all([BeniGo.myListings(), BeniGo.orders()]);
  }).then(function (results) {
    if (!user || !results) return;
    renderListings(results[0]);
    var orders = results[1];
    renderOrders(
      document.getElementById('myPurchases'),
      orders.filter(function (o) { return o.buyerId === user.id; }),
      'buyer',
      'Aucun achat pour le moment.'
    );
    renderOrders(
      document.getElementById('mySales'),
      orders.filter(function (o) { return o.sellerId === user.id; }),
      'seller',
      'Aucune vente pour le moment.'
    );
  }).catch(function (error) {
    var box = document.getElementById('myListings');
    if (box) {
      box.innerHTML = '';
      emptyMessage(box, error.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    BeniGo.logout().then(function () {
      window.location.href = 'index.html';
    });
  });

  function renderSubscription(account) {
    var line = document.getElementById('subscriptionLine');
    var expired = document.getElementById('subscriptionExpired');
    var abonnement = BeniGo.subscriptionStatus(account);
    if (abonnement.active) {
      var jours = abonnement.daysLeft;
      line.textContent = 'Actif jusqu au ' + BeniGo.dateLabel(abonnement.endAt) + ' (' +
        jours + (jours > 1 ? ' jours restants' : ' jour restant') + ').';
      expired.hidden = true;
      return;
    }
    line.textContent = abonnement.endAt
      ? 'Expire le ' + BeniGo.dateLabel(abonnement.endAt) + '.'
      : 'Aucun abonnement vendeur enregistre.';
    expired.textContent =
      'La publication de nouvelles annonces est bloquee. Contactez l equipe BeniGo pour renouveler votre abonnement.';
    expired.hidden = false;
  }

  function thumb(src, alt) {
    var box = document.createElement('div');
    box.className = 'entry-thumb';
    if (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = alt || '';
      box.appendChild(img);
    }
    return box;
  }

  function emptyMessage(container, text, linkHref, linkText) {
    var p = document.createElement('p');
    p.className = 'small muted';
    p.textContent = text;
    container.appendChild(p);
    if (linkHref) {
      var a = document.createElement('a');
      a.className = 'small';
      a.href = linkHref;
      a.textContent = linkText;
      container.appendChild(a);
    }
  }

  function renderListings(mine) {
    var box = document.getElementById('myListings');
    box.innerHTML = '';
    if (!mine.length) {
      emptyMessage(box, 'Vous n avez encore rien publie.', 'publier.html', 'Publier ma premiere annonce');
      return;
    }

    mine.forEach(function (listing) {
      var row = document.createElement('div');
      row.className = 'entry';

      var main = document.createElement('div');
      main.className = 'entry-main';
      main.appendChild(thumb(listing.images && listing.images[0], listing.title));

      var text = document.createElement('div');
      var title = document.createElement('p');
      title.className = 'entry-title';
      title.textContent = listing.title;
      var sub = document.createElement('p');
      sub.className = 'entry-sub';
      sub.textContent = BeniGo.money(listing.price) + ' - ' +
        (listing.status === 'active' ? 'en ligne' : 'reservee');
      text.appendChild(title);
      text.appendChild(sub);
      main.appendChild(text);

      var actions = document.createElement('div');
      actions.className = 'entry-actions';

      var see = document.createElement('a');
      see.className = 'btn ghost';
      see.href = 'annonce.html?id=' + encodeURIComponent(listing.id);
      see.textContent = 'Voir';
      actions.appendChild(see);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn danger';
      remove.textContent = 'Retirer';
      remove.addEventListener('click', function () {
        if (!window.confirm('Retirer cette annonce de la liste ?')) return;
        remove.disabled = true;
        BeniGo.removeListing(listing.id).then(function () {
          row.remove();
        }, function (error) {
          remove.disabled = false;
          window.alert(error.message);
        });
      });
      actions.appendChild(remove);

      row.appendChild(main);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  function renderOrders(container, list, role, emptyText) {
    container.innerHTML = '';
    if (!list.length) {
      emptyMessage(container, emptyText);
      return;
    }
    list.forEach(function (order) {
      var row = document.createElement('div');
      row.className = 'entry';

      var main = document.createElement('div');
      main.className = 'entry-main';
      main.appendChild(thumb(order.listingImage, order.listingTitle));

      var text = document.createElement('div');
      var title = document.createElement('p');
      title.className = 'entry-title';
      title.textContent = order.listingTitle;
      var sub = document.createElement('p');
      sub.className = 'entry-sub';
      var other = role === 'buyer'
        ? 'Vendeur : ' + order.sellerName
        : 'Acheteur : ' + order.buyerName;
      sub.textContent = BeniGo.money(order.price) + ' - ' + other + ' - ' +
        (BeniGo.STATUS_LABELS[order.status] || order.status);
      text.appendChild(title);
      text.appendChild(sub);
      main.appendChild(text);

      var actions = document.createElement('div');
      actions.className = 'entry-actions';
      var link = document.createElement('a');
      link.className = 'btn ghost';
      link.href = 'commande.html?ref=' + encodeURIComponent(order.ref);
      link.textContent = 'Suivre';
      actions.appendChild(link);

      row.appendChild(main);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }
})();
