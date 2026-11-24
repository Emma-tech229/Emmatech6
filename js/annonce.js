import BeniGo from './store.js';
(function () {
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id') || '';
  var notFound = document.getElementById('notFound');
  var listing = null;
  var user = null;

  BeniGo.me().then(function (account) {
    user = account;
    var nav = document.getElementById('navAccount');
    if (!user && nav) {
      nav.textContent = 'Connexion';
      nav.href = 'connexion.html';
    }
    return BeniGo.listing(id);
  }).then(function (result) {
    if (!result) {
      notFound.textContent = 'Cette annonce n existe pas ou a ete retiree.';
      notFound.hidden = false;
      return;
    }
    listing = result;
    render();
    return BeniGo.comments(listing.id).then(renderComments, function () {});
  }).catch(function (error) {
    notFound.textContent = error.message;
    notFound.hidden = false;
  });

  function render() {
    notFound.hidden = true;
    document.getElementById('detailGrid').hidden = false;
    document.getElementById('descriptionCard').hidden = false;
    document.getElementById('commentsCard').hidden = false;
    document.title = listing.title + ' - BeniGo';

    document.getElementById('condition').textContent = listing.condition;
    document.getElementById('title').textContent = listing.title;
    document.getElementById('price').textContent = BeniGo.money(listing.price);
    document.getElementById('meta').textContent =
      (listing.category || 'Autres') + ' - ' + (listing.place || 'Benin') +
      ' - publiee le ' + BeniGo.dateLabel(listing.createdAt) + ' par ' + listing.sellerName;
    document.getElementById('description').textContent = listing.description || 'Aucune description fournie.';

    var main = document.getElementById('galleryMain');
    var thumbs = document.getElementById('galleryThumbs');

    function showImage(src) {
      main.innerHTML = '';
      if (!src) {
        main.textContent = 'Aucune photo pour cet article.';
        return;
      }
      var img = document.createElement('img');
      img.src = src;
      img.alt = listing.title;
      main.appendChild(img);
    }

    var photos = listing.images || [];
    showImage(photos[0]);

    if (photos.length > 1) {
      photos.forEach(function (src, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = index === 0 ? 'on' : '';
        var img = document.createElement('img');
        img.src = src;
        img.alt = 'Photo ' + (index + 1);
        button.appendChild(img);
        button.addEventListener('click', function () {
          showImage(src);
          Array.prototype.forEach.call(thumbs.children, function (c) { c.classList.remove('on'); });
          button.classList.add('on');
        });
        thumbs.appendChild(button);
      });
    }

    var buyBtn = document.getElementById('buyBtn');
    var loginBtn = document.getElementById('loginBtn');
    var sellerNote = document.getElementById('sellerNote');
    var reservedNote = document.getElementById('reservedNote');

    if (!user) {
      buyBtn.hidden = true;
      loginBtn.hidden = false;
      loginBtn.href = 'connexion.html';
    } else if (user.id === listing.sellerId) {
      buyBtn.hidden = true;
      sellerNote.hidden = false;
    } else if (listing.status !== 'active') {
      buyBtn.hidden = true;
      reservedNote.hidden = false;
    } else {
      buyBtn.addEventListener('click', function () {
        window.location.href = 'paiement.html?id=' + encodeURIComponent(listing.id);
      });
    }
  }

  /* Commentaires */
  var list = document.getElementById('commentList');
  var form = document.getElementById('commentForm');
  var commentError = document.getElementById('commentError');
  var commentLogin = document.getElementById('commentLogin');

  function renderComments(items) {
    list.innerHTML = '';
    if (!items.length) {
      var none = document.createElement('p');
      none.className = 'small muted';
      none.textContent = 'Aucun commentaire pour le moment.';
      list.appendChild(none);
      return;
    }
    items.forEach(function (comment) {
      var box = document.createElement('div');
      box.className = 'comment';

      var head = document.createElement('div');
      head.className = 'comment-head';
      var author = document.createElement('span');
      author.className = 'comment-author';
      author.textContent = comment.name;
      var when = document.createElement('span');
      when.textContent = BeniGo.dateLabel(comment.createdAt);
      head.appendChild(author);
      head.appendChild(when);

      var body = document.createElement('p');
      body.textContent = comment.text;

      box.appendChild(head);
      box.appendChild(body);
      list.appendChild(box);
    });
  }

  BeniGo.me().then(function (account) {
    if (!account) {
      form.hidden = true;
      commentLogin.hidden = false;
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    commentError.hidden = true;
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    BeniGo.addComment(listing.id, document.getElementById('commentText').value)
      .then(function () {
        document.getElementById('commentText').value = '';
        button.disabled = false;
        return BeniGo.comments(listing.id).then(renderComments);
      })
      .catch(function (error) {
        button.disabled = false;
        commentError.textContent = error.message;
        commentError.hidden = false;
      });
  });
})();
