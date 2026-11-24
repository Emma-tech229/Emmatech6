import BeniGo from './store.js';
(function () {
  var form = document.getElementById('listingForm');
  var errorBox = document.getElementById('formError');
  var successBox = document.getElementById('formSuccess');
  var previews = document.getElementById('previews');
  var fileInput = document.getElementById('photos');
  var submitBtn = document.getElementById('submitBtn');
  var photos = [];
  var user = null;

  BeniGo.requireUser('connexion.html').then(function (account) {
    user = account;
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function resize(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Lecture de la photo impossible.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Photo illisible.')); };
        img.onload = function () {
          var max = 1000;
          var ratio = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (!blob) return reject(new Error('Compression impossible.'));
            resolve({ blob: blob, preview: canvas.toDataURL('image/jpeg', 0.6) });
          }, 'image/jpeg', 0.72);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPreviews() {
    previews.innerHTML = '';
    photos.forEach(function (photo, index) {
      var box = document.createElement('div');
      box.className = 'preview';

      var img = document.createElement('img');
      img.src = photo.preview;
      img.alt = 'Photo ' + (index + 1);
      box.appendChild(img);

      if (index === 0) {
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'Couverture';
        box.appendChild(tag);
      }

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'x';
      remove.setAttribute('aria-label', 'Retirer cette photo');
      remove.addEventListener('click', function () {
        photos.splice(index, 1);
        renderPreviews();
      });
      box.appendChild(remove);

      previews.appendChild(box);
    });
  }

  fileInput.addEventListener('change', function () {
    errorBox.hidden = true;
    var files = Array.prototype.slice.call(fileInput.files || []);
    var slots = 4 - photos.length;
    if (slots <= 0) {
      showError('Quatre photos suffisent. Retirez-en une pour en ajouter une autre.');
      fileInput.value = '';
      return;
    }

    var selected = files.slice(0, slots);
    if (files.length > slots) {
      showError('Seules les ' + slots + ' premieres photos ont ete ajoutees (4 maximum).');
    }

    Promise.all(selected.map(resize)).then(function (results) {
      results.forEach(function (photo) { photos.push(photo); });
      renderPreviews();
      fileInput.value = '';
    }).catch(function (error) {
      showError(error.message || 'Impossible de lire cette photo.');
      fileInput.value = '';
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    successBox.hidden = true;

    if (!user) {
      window.location.href = 'connexion.html';
      return;
    }

    submitBtn.disabled = true;
    successBox.textContent = 'Envoi des photos.';
    successBox.hidden = false;

    var urls = [];
    var chain = Promise.resolve();
    photos.forEach(function (photo) {
      chain = chain.then(function () {
        return BeniGo.uploadImage(photo.blob).then(function (url) { urls.push(url); });
      });
    });

    chain.then(function () {
      successBox.textContent = 'Publication de l annonce.';
      return BeniGo.addListing({
        title: document.getElementById('title').value,
        price: document.getElementById('price').value,
        category: document.getElementById('category').value,
        condition: document.getElementById('condition').value,
        place: document.getElementById('place').value,
        description: document.getElementById('description').value,
        images: urls
      });
    }).then(function (listing) {
      window.location.href = 'annonce.html?id=' + encodeURIComponent(listing.id);
    }).catch(function (error) {
      submitBtn.disabled = false;
      successBox.hidden = true;
      showError(error.message);
    });
  });

  renderPreviews();
})();
