# Tester l'app sur ton téléphone

## Option A — Expo Go (le plus rapide, aucun build)

⚠️ Expo Go **a toujours besoin de ce PC** : il retélécharge le bundle JS depuis le serveur Metro à chaque lancement (même en `--tunnel`, le tunnel ne fait que passer par Internet au lieu du Wi-Fi). Pour t'entraîner sans PC, voir l'option B.

Expo Go embarque déjà `expo-sqlite`, `expo-status-bar`, `react-native-safe-area-context` et `react-native-svg` : l'app tourne sans build natif.

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
- Repartir d'une base propre : `npx expo start -c` (vide le cache), le bouton « Réinitialiser toutes les données » (section suivante), ou supprime Expo Go / l'app du téléphone.

## Option B — APK autonome Android (l'app seule, sans PC)

Un *standalone build* embarque le code **dans** l'app : elle s'ouvre et fonctionne seule, **hors-ligne**, sans serveur de dev. C'est le profil `preview` de `eas.json` (`distribution: internal` + `android.buildType: apk`).

```bash
npx eas-cli@latest login      # compte Expo gratuit (une fois) — ou `register`
npx eas-cli@latest build --profile preview --platform android
```

- Le premier build crée le projet Expo et génère le **keystore Android** (géré par EAS). Garde bien ce compte : c'est lui qui permettra de livrer des mises à jour de la même app.
- À la fin, ouvre le lien (ou le QR) donné dans le terminal **sur le téléphone** → installe l'APK (autorise l'installation depuis cette source).
- Le premier lancement part d'une base **vierge** : elle est séparée de celle d'Expo Go, on arrive donc sur la création de profil.

À savoir :
- Après un changement de code, il faut **relancer un build** et réinstaller. Pour pousser le JS sans rebuild, `expo-updates` (EAS Update) est la suite logique — non installé pour l'instant.
- Pour des notifications fiables écran verrouillé : désactive l'**optimisation de batterie** pour l'app (Paramètres Android → Applications → AppSportLocal → Batterie → sans restriction).
- Cette app installée n'a besoin ni du PC ni d'Expo Go : c'est elle qu'on utilise au gymnase. Le build de développement (dev client) n'est utile que pour itérer sur du code natif — il demanderait `npx expo install expo-dev-client`.

## Option C — Build local

- Android : `npx expo run:android` (Android Studio + SDK requis) ; ajouter `--variant release` pour un APK autonome.
- iOS : `npx expo run:ios` (macOS + Xcode requis).

> Sur un **iPhone physique**, seul EAS Build fonctionne, avec un compte Apple Developer payant (distribution ad hoc) — ou un Mac + Xcode pour un sideload temporaire. Sans ça, Expo Go + PC reste la seule voie gratuite.

## Voir ce qui marche / ce qui casse

- Une erreur de chargement de la base s'affiche en **orange** dans l'app.
- **Repartir d'une base vierge sans désinstaller** : écran **Profils** (au lancement, ou ⚙ depuis le choix de compte) → bas de la liste → « Réinitialiser toutes les données ». Cela vide profils, groupes, séances et historique (`resetAppData`) et efface les préférences locales (compte actif, groupes masqués, barres/disques) — le catalogue d'exercices est conservé. Supprimer un seul profil depuis son menu « ⋯ » n'efface que ses données.
- **Génération de programme** (onglet **Séance** → carte « Générer un programme », ou automatiquement à la fin du questionnaire de profil) :
  1. L'aperçu doit afficher « Pourquoi ce programme ? », le volume par muscle, puis chaque séance avec ses exercices (vignette, séries × reps, repos). **Rien n'est enregistré à ce stade.**
  2. « Régénérer » doit changer les exercices (même structure, autre graine) — vérifie que le groupe n'est pas créé avant « Enregistrer ce programme ».
  3. Après enregistrement : le groupe apparaît dans l'onglet Séance avec ses séances ; la carte du haut indique `semaine 1/8` et le nombre de séances faites.
  4. Vérifie les exclusions : un profil avec « genoux » sensibles ne doit proposer ni squat, ni fente, ni extension, ni saut ; un profil « Maison » ne doit proposer ni barre ni haltères ; un profil sans « barre de traction » ne doit pas proposer de tractions.
  5. Charges de départ : après une première séance, regénère un programme contenant un exercice déjà fait → le poids saisi doit réapparaître dans la colonne « précédent ».
  6. Bloc de 8 semaines : pour tester la proposition de changement sans attendre, modifie `bloc_debut` dans `SESSION_GROUPS` (inspecteur SQLite, `Shift + M`) à une date de plus de 8 semaines → la carte de l'onglet Séance doit passer en « Bloc terminé ».
- **Notifications de fin de repos** : accepte la demande d'autorisation au premier entraînement. Expo Go (Android) n'embarque pas le module natif des *topics* push chargé par `expo-notifications` → `metro.config.js` redirige cet import vers le module de secours du paquet (sinon l'app plante au démarrage ; **redémarre le serveur Expo après toute modification de `metro.config.js`**). Deux cas à tester : (1) **app ouverte** → bip + notification immédiate à la fin du repos (logs `[repos] notification IMMÉDIATE présentée`) ; (2) **écran verrouillé / app en arrière-plan** → notification différée (log `[repos] notification DIFFÉRÉE dans N s`). Au retour au premier plan, `[repos] retour au premier plan : N notification(s) en attente` : si la notification différée n'apparaît **pas** et que le compte reste à 1, l'alarme n'a jamais sonné (limitation d'Expo Go → build de développement nécessaire).
- Les logs `console.*` et les erreurs apparaissent dans le terminal Expo.
- Vérification statique avant commit : `npx tsc --noEmit`.
- SQLite : ouvre l'inspecteur intégré — dans le terminal Expo, `Shift + M` → **Open expo-sqlite** pour parcourir/éditer les tables.

## Médias

- Les **vignettes 180×180** sont embarquées dans `assets/exercises/` (~12 Mo) → affichage instantané, hors-ligne (listes d'exercices du picker de séance).
- Les **GIF animés** (122 Mo au total) ne sont **pas** embarqués et ne sont **plus affichés** dans l'app (l'ancienne vue détail d'exercice a été retirée).
