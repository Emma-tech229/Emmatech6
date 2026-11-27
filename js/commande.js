import BeniGo from './store.js';
(function () {
  var params = new URLSearchParams(window.location.search);
  var ref = params.get('ref') || '';
  var errorBox = document.getElementById('error');
  var order = null;
  var user = null;

  BeniGo.requireUser('connexion.html').then(function (account) {
    user = account;
    if (!user) return null;
    return BeniGo.order(ref);
  }).then(function (result) {
    if (!user) return;
    if (!result) {
      errorBox.textContent = 'Commande introuvable. Ouvrez-la depuis votre profil.';
      errorBox.hidden = false;
      return;
    }
    order = result;
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      errorBox.textContent = 'Cette commande ne vous concerne pas.';
      errorBox.hidden = false;
      return;
    }
    render();
  }).catch(function (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  });

  function render() {
    var isBuyer = order.buyerId === user.id;
    var isSeller = order.sellerId === user.id;

    document.getElementById('orderBody').hidden = false;
    document.getElementById('ref').textContent = order.ref;
    document.getElementById('createdAt').textContent = 'Ouverte le ' + BeniGo.dateLabel(order.createdAt);
    document.getElementById('statusBadge').textContent = BeniGo.STATUS_LABELS[order.status] || order.status;

    document.getElementById('itemTitle').textContent = order.listingTitle;
    document.getElementById('sellerName').textContent = order.sellerName;
    document.getElementById('buyerName').textContent = order.buyerName;
    document.getElementById('deliveryMode').textContent = order.delivery === 'livreur'
      ? 'Livreur BeniGo' + (order.address ? ' - ' + order.address : '')
      : 'Point relais' + (order.relay ? ' - ' + order.relay : '');
    document.getElementById('amount').textContent = BeniGo.money(order.price);

    document.getElementById('code').textContent = order.code;
    document.getElementById('qrRef').textContent = order.ref;

    var qrBox = document.getElementById('qr');
    if (window.QRCode) {
      new QRCode(qrBox, {
        text: 'BENIGO|' + order.ref + '|' + order.code,
        width: 168,
        height: 168,
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrBox.textContent = 'Code QR indisponible';
    }

    document.getElementById('handoffHint').textContent = isBuyer
      ? 'Presentez ce code a la remise et reglez le montant au meme moment, en especes ou par mobile money.'
      : 'Verifiez le code, encaissez le montant, puis marquez le colis comme remis. Ne communiquez pas le code avant la remise.';

    var steps = [
      { key: 'commande', label: 'Commande enregistree, article reserve', who: 'acheteur' },
      { key: 'expediee', label: 'Article remis a la livraison', who: 'vendeur' },
      { key: 'terminee', label: 'Article recu, paiement regle', who: 'acheteur' }
    ];
    var rank = { commande: 0, expediee: 1, terminee: 2 };
    var currentIndex = rank[order.status] || 0;
    var timeline = document.getElementById('timeline');
    var history = order.history || [];
    timeline.innerHTML = '';

    steps.forEach(function (step, index) {
      var li = document.createElement('li');
      if (index < currentIndex) li.className = 'done';
      if (index === currentIndex) li.className = 'current';

      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = step.label;
      li.appendChild(label);

      var stamp = history.filter(function (h) { return h.status === step.key; })[0];
      var when = document.createElement('span');
      when.className = 'when';
      if (stamp) {
        when.textContent = BeniGo.dateLabel(stamp.at);
      } else {
        when.className = 'when pending';
        when.textContent = index > currentIndex
          ? (step.who === 'vendeur' ? 'En attente du vendeur' : 'En attente de l acheteur')
          : 'En cours';
      }
      li.appendChild(when);
      timeline.appendChild(li);
    });

    var actions = document.getElementById('actions');
    var message = document.getElementById('actionMessage');
    actions.innerHTML = '';

    function act(run, label, confirmText) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = label;
      button.addEventListener('click', function () {
        if (confirmText && !window.confirm(confirmText)) return;
        button.disabled = true;
        run().then(function () {
          window.location.reload();
        }, function (error) {
          button.disabled = false;
          message.textContent = error.message;
          message.className = 'alert error';
          message.hidden = false;
        });
      });
      actions.appendChild(button);
    }

    if (isSeller && order.status === 'commande') {
      act(
        function () { return BeniGo.shipOrder(order.ref); },
        'J ai remis le colis et encaisse le paiement',
        'Confirmez-vous avoir remis l article et encaisse le montant ?'
      );
    }

    if (isBuyer && order.status !== 'terminee') {
      act(
        function () { return BeniGo.confirmReception(order.ref); },
        'J ai recu l article et j ai paye',
        'Confirmez-vous avoir recu l article et regle le montant a la remise ?'
      );
    }

    if (order.status === 'terminee') {
      var done = document.createElement('p');
      done.className = 'alert';
      done.textContent = 'Commande terminee. Le paiement a ete regle a la remise. Vous pouvez laisser un commentaire sur l annonce.';
      actions.appendChild(done);
    }

    if (!actions.children.length) {
      var info = document.createElement('p');
      info.className = 'small muted';
      info.textContent = isBuyer
        ? 'Le vendeur prepare le colis. Le bouton de confirmation apparaitra ici.'
        : 'L acheteur confirmera la reception depuis son compte.';
      actions.appendChild(info);
    }
  }
})();
