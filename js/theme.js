/* Applique la palette choisie sur le profil. Quatre themes disponibles. */
(function (global) {
  var KEY = 'benigo.theme';
  var THEMES = ['vert', 'indigo', 'terre', 'nuit'];
  var LABELS = {
    vert: 'Vert Benin',
    indigo: 'Indigo',
    terre: 'Terre cuite',
    nuit: 'Nuit'
  };

  function get() {
    var v;
    try { v = global.localStorage.getItem(KEY); } catch (e) { v = null; }
    return THEMES.indexOf(v) === -1 ? 'vert' : v;
  }

  function apply(name) { global.document.documentElement.setAttribute('data-theme', name); }

  function set(name) {
    if (THEMES.indexOf(name) === -1) name = 'vert';
    try { global.localStorage.setItem(KEY, name); } catch (e) {}
    apply(name);
    return name;
  }

  apply(get());

  global.BeniGoTheme = { THEMES: THEMES, LABELS: LABELS, get: get, set: set, apply: apply };
})(window);
