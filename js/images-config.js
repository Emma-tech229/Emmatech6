/* Hebergement des photos des annonces : Cloudinary, offre gratuite sans carte
   bancaire. L envoi se fait depuis le navigateur avec un preset NON SIGNE :
   il ne permet que de deposer une image, avec les options figees dans le
   preset (dossier, taille maximale, formats).

   Le compte actuel a ete cree automatiquement (compte provisoire Cloudinary).
   Il doit etre reclame avec le lien fourni lors de la mise en place, dans les
   24 heures : passe ce delai le compte et les photos sont supprimes. Une fois
   reclame, le cloudName et le preset restent les memes, rien a changer ici.

   Pour un autre compte, depuis https://console.cloudinary.com :
   1. Dashboard : recopiez "Cloud name" dans cloudName ci-dessous.
   2. Settings > Upload > Upload presets > Add upload preset :
      - Signing mode : Unsigned
      - Name : benigo_annonces, a recopier dans uploadPreset
      - Asset folder : benigo (les photos arrivent dans ce dossier)
      - Allowed formats : jpg, png, webp
   3. Enregistrez, puis rechargez le site.

   Ces deux valeurs sont publiques, comme la configuration Firebase : elles
   n ouvrent que le droit de deposer une photo. */
export const imageHost = {
  cloudName: 'njzesnjr',
  uploadPreset: 'benigo_annonces'
};

export function imageHostConfigured() {
  const cloud = String(imageHost.cloudName || '');
  const preset = String(imageHost.uploadPreset || '');
  return Boolean(cloud) && Boolean(preset) && !/REMPLACER/i.test(cloud + preset);
}
