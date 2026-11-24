import BeniGo from './store.js';
(function () {
  var CATEGORIES = ['Tout', 'Telephones', 'Informatique', 'Maison', 'Vetements', 'Vehicules', 'Autres'];

  var grid = document.getElementById('listings');
  var empty = document.getElementById('empty');
  var count = document.getElementById('feedCount');
  var search = document.getElementById('search');
  var chips = document.getElementById('chips');
  var activeCategory = 'Tout';
  var timer = null;

  BeniGo.me().then(function (user) {
    var account = document.getElementById('navAccount');
    if (!user && account) {
      account.textContent = 'Connexion';
      account.href = 'connexion.html';
    }
  });

  CATEGORIES.forEach(function (name) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (name === activeCategory ? ' on' : '');
    chip.textContent = name;
    chip.addEventListener('click', function () {
      activeCategory = name;
      Array.prototype.forEach.call(chips.children, function (c) {
        c.classList.toggle('on', c.textContent === name);
      });
      render();
    });
    chips.appendChild(chip);
  });

  function card(listing) {
    var article = document.createElement('article');
    article.className = 'listing';

    var link = document.createElement('a');
    link.href = 'annonce.html?id=' + encodeURIComponent(listing.id);

    var thumb = document.createElement('div');
    thumb.className = 'listing-thumb';
    if (listing.images && listing.images[0]) {
      var img = document.createElement('img');
      img.src = listing.images[0];
      img.alt = listing.title;
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      thumb.textContent = 'Sans photo';
    }

    var body = document.createElement('div');
    body.className = 'listing-body';

    var title = document.createElement('div');
    title.className = 'listing-title';
    title.textContent = listing.title;

    var price = document.createElement('div');
    price.className = 'listing-price';
    price.textContent = BeniGo.money(listing.price);

    var meta = document.createElement('div');
    meta.className = 'listing-meta';
    var place = document.createElement('span');
    place.textContent = listing.place || 'Benin';
    var seller = document.createElement('span');
    seller.textContent = listing.sellerName;
    meta.appendChild(place);
    meta.appendChild(seller);

    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(meta);

    link.appendChild(thumb);
    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function render() {
    count.textContent = 'Chargement des annonces.';
    return BeniGo.listings({ q: search.value, category: activeCategory }).then(function (items) {
      grid.innerHTML = '';
      items.forEach(function (listing) { grid.appendChild(card(listing)); });

      empty.hidden = items.length > 0;
      if (!items.length) {
        count.textContent = 'Aucun article ne correspond a votre recherche.';
      } else {
        count.textContent = items.length + (items.length === 1 ? ' article disponible.' : ' articles disponibles.');
      }
    }, function (error) {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.querySelector('strong').textContent = 'Annonces indisponibles.';
      empty.querySelector('.small').textContent = error.message;
      count.textContent = '';
    });
  }

  search.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  });

  render();
})();
