# Tester l'app sur ton téléphone

## Option A — Expo Go (le plus rapide, aucun build)

Expo Go embarque déjà `expo-sqlite`, `expo-status-bar` et `react-native-safe-area-context` : l'app tourne sans build natif.

1. Installe **Expo Go** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) et **mets-le à jour** (il faut la version supportant le SDK 57).
2. Depuis la racine du projet :
   ```bash
   npx expo start
   ```
3. Scanne le QR code :
   - **Android** : ouvre Expo Go → « Scan QR code ».
   - **iOS** : ouvre l'appareil photo → le lien s'ouvre dans Expo Go.
4. Le téléphone et le PC doivent être sur le **même réseau Wi-Fi**. Si ça ne se connecte pas :
   ```bash
   npx expo start --tunnel
   ```

Pendant le dev :
- Sauvegarde un fichier → **Fast Refresh** recharge tout seul.
- Terminal : `r` = reload, `m` = menu dev, `j` = debugger.
- Repartir d'une base propre : `npx expo start -c` (vide le cache) et/ou supprime Expo Go / l'app du téléphone.

## Option B — Development build (si Expo Go ne suffit pas)

Nécessaire dès qu'une lib avec du code natif **absent d'Expo Go** est ajoutée.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Puis installe l'APK généré. (`eas.json` n'existe pas encore dans ce dépôt : à configurer.)

## Option C — Build local

- Android : `npx expo run:android` (Android Studio + SDK requis).
- iOS : `npx expo run:ios` (macOS + Xcode requis).

## Voir ce qui marche / ce qui casse

- En haut de l'écran, un **diagnostic** s'affiche : version SQLite, version du schéma (`user_version`), nombre de lignes.
- Une erreur de chargement de la base s'affiche en **orange** dans l'app.
- Les logs `console.*` et les erreurs apparaissent dans le terminal Expo.
- Vérification statique avant commit : `npx tsc --noEmit`.
- SQLite : ouvre l'inspecteur intégré — dans le terminal Expo, `Shift + M` → **Open expo-sqlite** pour parcourir/éditer les tables.

## Médias

- Les **vignettes 180×180** sont embarquées dans `assets/exercises/` (~12 Mo) → affichage instantané, hors-ligne.
- Les **GIF animés** (122 Mo au total) ne sont **pas** embarqués : ils sont chargés à la demande depuis GitHub. Sans réseau, la vignette reste visible mais le GIF ne s'affiche pas.
