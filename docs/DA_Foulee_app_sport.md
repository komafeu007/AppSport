# Foulée : direction artistique

Version 1.0. Document de référence pour le design, le développement et le contenu.

---

## 0. Hypothèses de départ

Le brief ne précisait ni le sport ni la cible. Pour que la DA soit spécifique plutôt que générique, j’ai posé une base concrète. Si elle change, 80 % du système reste valable (grille, typo, composants, règles), seuls la palette et le ton seraient à réajuster.

| Point | Hypothèse |
|---|---|
| Produit | Suivi d’entraînement qui combine course à pied et musculation |
| Public | Sportifs amateurs réguliers, 22 à 45 ans, 3 à 5 séances par semaine |
| Mission principale | Lancer une séance en 2 touches, saisir ses séries sans regarder l’écran plus de 2 secondes, voir sa progression sur plusieurs semaines |
| Plateformes | Mobile iOS et Android, mobile first |
| Langue | Français (les règles de format de nombres et de dates en tiennent compte) |
| Nom de travail | Foulée (à vérifier côté disponibilité de marque) |

---

## 1. Concept : le marquage au sol

Tous les lieux de sport partagent un langage graphique : lignes peintes au sol, couloirs de piste, ligne de départ, chronomètre, tableau de score. Foulée reprend ce vocabulaire fonctionnel. Rien n’est décoratif : une ligne sert à séparer, une graduation sert à mesurer, un chiffre sert à lire d’un coup d’œil.

### Cinq principes

1. **Le chiffre d’abord.** Charge, répétitions, temps, distance : c’est le contenu de l’app. Il est toujours plus grand que tout ce qui l’entoure.
2. **Une seule chose mise en avant par écran.** Une action principale, un élément dominant. Le reste est calme.
3. **Utilisable en mouvement.** Mains moites, plein soleil, regard de deux secondes, une seule main. Cibles tactiles larges, contrastes élevés, aucune information essentielle en petit.
4. **La structure remplace le décor.** Filets, graduations, alignements. Pas d’ombres décoratives, pas de dégradés, pas de verre dépoli.
5. **Un coach, pas un animateur.** Le ton est direct, factuel, sans cris ni emojis. Il donne l’information, il ne félicite pas à outrance.

### Où se dépense l’audace

À un seul endroit : **le chiffre géant** de l’écran de séance, en condensé très gras, qui occupe jusqu’à 40 % de la hauteur. C’est l’élément mémorable de la marque. Tout le reste est volontairement sobre et discipliné pour le laisser parler.

---

## 2. Règles de base du design et leur application

| Règle | Application dans Foulée |
|---|---|
| Hiérarchie visuelle | Trois niveaux de taille nettement séparés (chiffres, titres, texte). Un seul élément dominant par écran. |
| Contraste | Texte courant au minimum 4,5:1, texte large et éléments d’interface au minimum 3:1. Les ratios sont documentés en section 5. |
| Alignement | Tout texte aligné à gauche sur une même marge. Les nombres sont alignés à droite, sur la virgule décimale, dans les listes. |
| Proximité | Éléments liés rapprochés (8 à 12 px), groupes distincts éloignés (32 px). L’espace sépare avant le trait. |
| Répétition | Un composant, un comportement, partout. Un bouton principal est toujours bleu, un lien est toujours bleu, rien d’autre n’est bleu. |
| Espace négatif | Marges de 20 px, respiration verticale généreuse, pas de remplissage « pour que ça fasse plein ». |
| Grille | Base de 4 px, grille à 4 colonnes sur mobile, 8 sur tablette. |
| Lisibilité | Deux familles seulement, graisse minimale 400, interlignage 1,5 pour le corps. |
| Proportion des couleurs | Environ 60 % de neutres, 25 % de marine, 12 % de bleu, 3 % de jaune au maximum. |
| Loi de Fitts | Cibles tactiles de 48 px minimum (56 px en séance), actions principales dans le tiers bas de l’écran, à portée du pouce. |
| Loi de Hick | Peu de choix par écran. Une action principale, une ou deux secondaires. |

---

## 3. Ce qu’on s’interdit pour ne pas faire « généré par IA »

Ces traits reviennent partout dans les interfaces produites en série. Ils ne sont pas interdits par principe, mais ici aucun ne répond au sujet.

- Fond crème avec un serif contrasté et un accent terracotta.
- Fond presque noir avec un unique accent vert acide ou vermillon.
- Dégradés violet-bleu, halos flous, effets de verre dépoli.
- Écran découpé en cartes identiques, même rayon, même ombre grise douce.
- Anneaux d’activité et jauges circulaires, vus partout.
- Emojis utilisés comme icônes ou comme ponctuation du ton.
- Petits labels en majuscules espacées au-dessus de chaque titre.
- Numérotation 01, 02, 03 sur du contenu qui n’est pas une séquence.
- Un seul mot mis en couleur ou en italique dans un titre.
- Flèche collée au texte des boutons, chaînes de métadonnées séparées par des points médians.
- Police monospace pour les petits libellés de données.
- Animations d’apparition sur chaque section, survol animé sur chaque carte.
- Illustrations 3D lisses, photos de banque d’images de gens qui sautent en souriant.
- Texte de motivation générique : « Libère ton potentiel », « Deviens la meilleure version de toi-même ».

---

## 4. Journal des arbitrages

Premier réflexe, puis ce qui a été retenu à la place.

| Premier réflexe | Pourquoi je l’ai écarté | Choix retenu |
|---|---|---|
| Fond noir, accent vert ou orange fluo | Look « app fitness » de série, sans lien avec un lieu réel | Bleu de terrain de sport, jaune de balisage, marine à la place du noir |
| Rouge brique ou terracotta de piste d’athlétisme | Trop proche des palettes chaudes devenues génériques | Bleu court de handball ou de volley, plus rare et très lisible en extérieur |
| Anneaux de progression | Cliché de l’univers santé | Couloirs de piste gradués : le trait encode la distance ou le nombre de séances |
| Zones d’effort en arc-en-ciel (bleu, vert, jaune, orange, rouge) | Illisible pour le daltonisme, entre en conflit avec les couleurs d’état | Rampe de bleu unique : plus l’effort est intense, plus la teinte est contrastée |
| Cartes partout | Hiérarchie plate, aspect gabarit | Une seule carte par écran, pour l’action principale. Le reste est à plat, séparé par des filets |
| Inter ou Space Grotesk en tout | Choix par défaut | Big Shoulders Display (enseignes de ville, condensé, chiffres très marqués) et Public Sans (neutre, très lisible) |
| Noir pur ou noir teinté standard | Choix réflexe | Marine profond dérivé du bleu de la marque |
| Ombre grise sous chaque élément | Marque de fabrique des interfaces génériques | Pas d’ombre par défaut. Une seule ombre pour les feuilles modales, teintée marine |

---

## 5. Couleur

### 5.1 Palette de base (mode clair)

| Nom | Hex | Rôle |
|---|---|---|
| Bleu court | `#2347D6` | Action principale, liens, remplissage de progression, onglet actif |
| Bleu appui | `#1A38B0` | État pressé du bleu court |
| Marine | `#0D1B4C` | Texte principal, icônes, contours des éléments jaunes, remplace le noir |
| Jaune balise | `#FFD60A` | Marqueur : série en cours, record, ligne de départ. Jamais seul sur fond clair |
| Dalle | `#EEF1F6` | Fond d’écran |
| Blanc ligne | `#FFFFFF` | Surface surélevée (la carte de la séance du jour), champs |
| Craie | `#D5DAE5` | Filets, rails vides, bordures de champs |
| Ardoise | `#5B6478` | Texte secondaire, axes de graphiques |

Couleurs d’état :

| Nom | Hex | Rôle |
|---|---|---|
| Rouge piste | `#D1273B` | Erreur, suppression, alerte |
| Vert gazon | `#187A41` | Succès, objectif atteint |

### 5.2 Rampe des zones d’effort

Une seule teinte, du plus léger au plus intense. Chaque segment est étiqueté Z1 à Z5, la couleur n’est jamais la seule information.

| Zone | Mode clair | Mode sombre |
|---|---|---|
| Z1 récupération | `#C9D5F7` | `#34478F` |
| Z2 endurance | `#93A9EF` | `#4F69C9` |
| Z3 tempo | `#5B7BE6` | `#7C95FF` |
| Z4 seuil | `#2347D6` | `#B3C2FF` |
| Z5 maximal | `#0D1B4C` | `#F2F5FF` |

La barre est entourée d’un filet de 1 px `#A9B6D3` pour que la zone 1 reste visible sur fond clair.

### 5.3 Contrastes vérifiés (WCAG 2.1)

Ratios calculés sur les valeurs ci-dessus, à revérifier sur les maquettes finales.

| Combinaison | Ratio | Niveau |
|---|---|---|
| Marine sur Blanc | 16,5:1 | AAA |
| Marine sur Dalle | 14,6:1 | AAA |
| Blanc sur Bleu court (bouton principal) | 7,1:1 | AAA |
| Bleu court sur Dalle (liens) | 6,3:1 | AA |
| Ardoise sur Blanc | 5,9:1 | AA |
| Ardoise sur Dalle | 5,3:1 | AA |
| Marine sur Jaune balise | 11,7:1 | AAA |
| Jaune balise sur Bleu court (graphique) | 5,1:1 | Supérieur à 3:1 |
| Blanc sur Rouge piste | 5,2:1 | AA |
| Blanc sur Vert gazon | 5,4:1 | AA |

### 5.4 Règles d’usage

- **Une couleur, un rôle.** Le bleu signifie « on peut agir dessus ». Rien d’autre n’est bleu, sauf les données de progression.
- **Le jaune n’est jamais seul sur fond clair.** Il est toujours accompagné de marine (texte, contour de 2 px). Sur fond bleu ou marine, il peut être utilisé seul.
- **Le jaune ne dépasse pas 3 % de la surface.** Son rôle est de désigner « ici, maintenant » ou « record ».
- **Rouge et vert ne portent jamais l’information seuls.** Toujours accompagnés d’une icône et d’un texte.
- **Pas de dégradé. Pas de transparence pour fabriquer des teintes.** Les couleurs sont des jetons opaques.
- **Pas d’ombre grise.** La seule ombre autorisée est teintée marine (section 7.6).

---

## 6. Typographie

### 6.1 Familles

| Rôle | Famille | Pourquoi |
|---|---|---|
| Display : chiffres et titres | **Big Shoulders Display** (Google Fonts, licence OFL) | Condensé inspiré de la signalétique urbaine. Gagne beaucoup de place pour de gros chiffres, terminaisons coupées droit, très cohérent avec l’idée de marquage |
| Texte et interface | **Public Sans** (Google Fonts, licence OFL) | Grotesque neutre conçue pour la lisibilité. Reste discrète à côté du display, très bon rendu en petit |

Deux familles clairement distinctes : l’une est expressive et étroite, l’autre est neutre et ouverte. Pas de troisième police, pas de monospace.

Pile de repli : `"Big Shoulders Display", "Arial Narrow", sans-serif` et `"Public Sans", system-ui, sans-serif`.

### 6.2 Échelle typographique

| Jeton | Famille | Graisse | Taille / interligne | Usage |
|---|---|---|---|---|
| num-xl | Big Shoulders | 800 | 120 / 104 | Chiffres de l’écran de séance : charge, répétitions, chrono |
| num-l | Big Shoulders | 800 | 64 / 60 | Chiffre clé d’un écran (distance, durée de fin de séance) |
| num-m | Big Shoulders | 700 | 32 / 32 | Valeurs dans les listes et tableaux |
| titre-1 | Big Shoulders | 800 | 36 / 38 | Titre d’écran |
| titre-2 | Big Shoulders | 700 | 28 / 32 | Titre de section |
| titre-3 | Public Sans | 600 | 18 / 24 | Titre de bloc, nom d’exercice |
| corps | Public Sans | 400 | 16 / 24 | Texte courant |
| corps-s | Public Sans | 400 | 14 / 20 | Texte secondaire, aides |
| légende | Public Sans | 500 | 12 / 16 | Axes, unités, mentions. Jamais pour une information essentielle |
| bouton | Public Sans | 600 | 16 / 20 | Libellés de boutons |

Interlettrage à 0 partout. Les titres et libellés sont en minuscules avec majuscule initiale (casse de phrase), jamais en capitales.

### 6.3 Règles

- **Chiffres tabulaires** pour tout ce qui change en direct (chrono, charge, répétitions) : `font-variant-numeric: tabular-nums`. Si Big Shoulders ne fournit pas ce réglage à l’intégration, fixer la largeur de chaque chiffre pour que le chrono ne « tremble » pas.
- **Longueur de ligne** : 40 caractères environ sur mobile, 66 maximum sur tablette. Jamais plus de 80.
- **Alignement** : texte à gauche. Centrage réservé aux chiffres géants de la séance et aux états vides. Pas de texte justifié.
- **Pas de mot isolé en couleur ou en italique dans un titre.** Pour hiérarchiser, on change de taille ou de graisse, pas de couleur.
- **Pas d’étiquette décorative** au-dessus des titres. Un libellé n’existe que s’il apporte une information.
- **Dynamic Type** (iOS) et taille de police système (Android) pris en charge jusqu’à 200 % pour le texte. Les chiffres de séance sont plafonnés à 130 % pour rester dans l’écran.

### 6.4 Format des nombres, unités et dates (français)

| Élément | Format | Exemple |
|---|---|---|
| Décimales | Virgule | 82,5 kg |
| Milliers | Espace insécable | 4 120 kg |
| Unités | Espace insécable avant l’unité, abréviations standard | 12,4 km, 5:12 min/km |
| Durée courte | mm:ss | 52:14 |
| Durée longue | h et min | 1 h 05 |
| Heure | Format 24 h | 18:30 |
| Date | Jour en toutes lettres, pas de zéro initial | mardi 20 octobre |
| Multiplication | Signe × | 4 × 8 |

---

## 7. Grille, espacement et mise en page

### 7.1 Espacement

Base de 4 px. Jetons : 4, 8, 12, 16, 20, 24, 32, 48, 64.

| Contexte | Valeur |
|---|---|
| Marge latérale d’écran | 20 |
| Entre éléments liés (titre et sous-titre) | 4 à 8 |
| Entre éléments d’un même groupe | 12 |
| Entre titre de section et son contenu | 12 |
| Entre sections | 32 |
| Marge basse au-dessus de la barre d’onglets | 24 |

### 7.2 Grille

- Mobile : 4 colonnes, gouttière 16, marges 20.
- Tablette : 8 colonnes, gouttière 24, marges 32. Le contenu est limité à 640 px de large au centre en mode portrait pour garder des lignes courtes.
- Respect strict des zones de sécurité (encoche, barre d’accueil).

### 7.3 Zone du pouce

Les actions principales vivent dans le tiers bas de l’écran. Le haut de l’écran sert à l’information et à l’orientation. Les actions destructives ne sont jamais dans la zone la plus facile d’accès.

### 7.4 Alignement

- Tout le texte est aligné sur la marge de 20 px.
- Dans les listes, libellés à gauche, valeurs à droite, alignées sur la virgule.
- Les icônes d’une même colonne partagent le même axe vertical.

### 7.5 Rayons

Les rayons varient selon le rôle, pas selon l’envie.

| Jeton | Valeur | Éléments |
|---|---|---|
| r-xs | 4 | Rails de progression, repères |
| r-s | 8 | Cartes, filtres, pastilles |
| r-m | 12 | Boutons, champs de saisie |
| r-l | 20 | Coins supérieurs des feuilles modales |
| r-full | 999 | Avatars, interrupteurs |

### 7.6 Élévation

Pas d’ombre par défaut. La séparation se fait par la couleur de surface (Dalle contre Blanc) et par des filets de 1 px en Craie. Une seule ombre existe, pour les feuilles modales : `0 -8px 24px rgba(13, 27, 76, 0.12)`, teintée marine et non grise.

### 7.7 Maquettes de référence

Les maquettes ci-dessous sont indicatives. Elles montrent la structure, pas le rendu final.

**Accueil (Aujourd’hui)**

```
┌──────────────────────────────────────┐
│                                      │
│  mardi 20 octobre                    │
│  Jambes et gainage                   │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Squat                    4 × 8 │  │
│  │ Fentes marchées         3 × 12 │  │
│  │ Soulevé roumain          3 × 8 │  │
│  │ + 3 exercices                  │  │
│  │                                │  │
│  │ ┌────────────────────────────┐ │  │
│  │ │    Commencer la séance     │ │  │
│  │ └────────────────────────────┘ │  │
│  └────────────────────────────────┘  │
│                                      │
│  Cette semaine                       │
│  ██████│██████│██████│░░░░░░  3 sur 4│
│                                      │
│  Dernières séances                   │
│  Course, sortie longue       12,4 km │
│  Haut du corps                48 min │
│  Course, fractionné           8,2 km │
│                                      │
├──────────────────────────────────────┤
│ Aujourd’hui  Séances  Progrès  Profil│
└──────────────────────────────────────┘
```

- Une seule carte : la séance du jour, car c’est la seule chose sur laquelle on agit.
- Le couloir de la semaine est gradué : chaque séparation correspond à une séance prévue.
- Les dernières séances sont en liste à plat, valeurs alignées à droite.

**Séance en cours** (affichée en mode sombre par défaut, voir section 14)

```
┌──────────────────────────────────────┐
│  Squat                     Terminer  │
│                                      │
│  Série 3 sur 4                       │
│                                      │
│        80           8                │
│        kg         reps               │
│                                      │
│    [ − ] [ + ]        [ − ] [ + ]    │
│                                      │
│  Dernière fois : 80 kg × 8           │
│                                      │
│  Repos                         01:32 │
│  ████████████████████░░░░░░░░░░░░░░  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │        Valider la série        │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- Les deux chiffres (charge et répétitions) sont en num-xl et dominent l’écran.
- Les boutons − et + font 56 × 56 px, avec maintien appuyé pour accélérer.
- La référence de la dernière séance est discrète, juste sous la saisie.
- Le bouton « Valider la série » est dans la zone du pouce.

**Progrès**

```
┌──────────────────────────────────────┐
│                                      │
│  Progrès                             │
│  Squat                          ▾    │
│                                      │
│  Semaine   Mois   Année              │
│  ───────                             │
│                                      │
│  100 ┤                         ◆     │
│   90 ┤                     ●         │
│   80 ┤            ●    ●             │
│   70 ┤  ●    ●                       │
│      └─────────────────────────────  │
│       sept.                    oct.  │
│                                      │
│  Charge maximale             100 kg  │
│  Volume de la semaine      4 120 kg  │
│                                      │
├──────────────────────────────────────┤
│ Aujourd’hui  Séances  Progrès  Profil│
└──────────────────────────────────────┘
```

- Le graphique réel est une courbe continue, ici simplifiée en points.
- Le losange marque le record : jaune cerné de marine.
- Les valeurs clés sont lisibles sous le graphique, sans avoir à interpréter la courbe.

---

## 8. Composants

### 8.1 Boutons

| Variante | Fond | Texte | Usage |
|---|---|---|---|
| Principal | Bleu court | Blanc | Une seule par écran |
| Secondaire | Aucun, contour 1,5 px bleu court | Bleu court | Alternative à l’action principale |
| Tertiaire | Aucun | Bleu court | Actions légères (Annuler, Ignorer) |
| Destructif | Rouge piste | Blanc | Jamais par défaut, toujours avec confirmation |

Tailles : grand 56 px (écran de séance, action principale), standard 48 px, compact 44 px. Rayon 12. Marges internes horizontales 24. Libellé en bouton 600 / 16, casse de phrase, sans flèche, sans icône sauf si elle précise l’action.

États : repos, pressé (Bleu appui), désactivé (fond Craie, texte Ardoise), focus clavier (anneau de 2 px marine avec 2 px de décalage), chargement (le libellé devient « Enregistrement… » et la ligne de départ se trace en bas du bouton).

### 8.2 Champs de saisie

- Hauteur 56, rayon 12, fond Blanc, bordure 1 px Craie.
- Focus : bordure 2 px bleu court. Erreur : bordure 2 px rouge piste, icône et message sous le champ.
- Le libellé est toujours visible au-dessus du champ (14 / 600), jamais remplacé par le texte indicatif.
- Les unités sont accolées dans le champ (suffixe kg, km).

### 8.3 Saisie rapide (stepper)

- Valeur au centre en num-xl, appui dessus pour taper au clavier numérique.
- Boutons − et + de 56 × 56 px, de part et d’autre.
- Appui long : répétition accélérée.
- Incréments configurables : 2,5 kg et 1 répétition par défaut.
- Valeurs pré-remplies avec la dernière séance, modifiables en un appui.

### 8.4 Cartes

Une carte maximum par écran, réservée à ce qui est actionnable (la séance du jour). Fond Blanc, rayon 8, bordure 1 px Craie, aucune ombre. Le reste du contenu est à plat, séparé par l’espace et par des filets.

### 8.5 Listes

- Hauteur minimale 56 (une ligne) ou 64 (deux lignes).
- Titre à gauche, valeur à droite en num-m.
- Filets de 1 px Craie, commençant à la marge de 20 px.
- Un chevron n’apparaît que si la ligne ouvre un détail.

### 8.6 Couloir de progression

Remplace les anneaux d’activité.

- Hauteur 12, rayon 4, rail en Craie.
- Remplissage en Bleu court.
- Les graduations (traits de 1 px Marine) marquent les unités : une séparation par séance prévue, ou un repère par kilomètre.
- Le marqueur d’objectif est un trait marine de 2 px qui dépasse de 4 px au-dessus et au-dessous du rail.
- La valeur est toujours écrite en texte à côté (« 3 sur 4 »).

### 8.7 Zones d’effort

Barre horizontale de 16 px de haut, segments séparés par 2 px de blanc, largeur proportionnelle au temps passé dans chaque zone, étiquettes Z1 à Z5 en dessous avec les durées.

### 8.8 Filtres et sélecteurs

- Hauteur visuelle 36, zone tactile étendue à 44 par une marge invisible.
- Rayon 8. Sélectionné : fond Marine, texte Blanc. Non sélectionné : fond Dalle, texte Marine.
- Le jaune n’est pas utilisé pour la sélection.

### 8.9 Barre d’onglets

Quatre onglets : Aujourd’hui, Séances, Progrès, Profil. Icône 24 px et libellé 12 / 500 toujours visibles. Onglet actif en Bleu court avec un trait de 3 px en haut de l’onglet, à la manière d’une ligne de départ. Hauteur 56 px plus la zone de sécurité basse. Fond Blanc, filet supérieur 1 px Craie.

### 8.10 Feuille modale (bottom sheet)

Rayon 20 sur les coins supérieurs, poignée de 36 × 4 px en Craie, ombre teintée marine, voile Marine à 40 % derrière.

### 8.11 Notification temporaire (toast)

Bandeau bas, au-dessus de la barre d’onglets. Fond Marine, texte Blanc 14 / 20, durée 4 secondes. L’action éventuelle (Annuler) est en Jaune balise, autorisé ici car posé sur fond marine.

### 8.12 États vides, chargement, erreur

- **Vide** : schéma de terrain ou de piste tracé en Craie avec un seul trait marine, un titre qui dit ce qui manque, une action claire.
- **Chargement** : blocs en Craie statiques, sans effet de balayage lumineux. Pour les actions longues, la ligne de départ se trace.
- **Erreur** : dit ce qui s’est passé et ce qu’on peut faire, sans s’excuser ni dramatiser, avec icône et texte.

---

## 9. Identité de marque et iconographie

### 9.1 Logotype

« Foulée » en Big Shoulders Display 800, majuscule initiale. Pas d’effet, pas de contour, pas de dégradé. Une seule version couleur par fond : Marine sur fond clair, Blanc sur fond bleu ou marine.

### 9.2 Icône d’application

- Fond plein Bleu court.
- Un grand F en Big Shoulders 800, Blanc, aligné à gauche, qui occupe environ 55 % de la hauteur.
- Sous le F, un trait horizontal Jaune balise de 10 % de la hauteur, qui part de la marge gauche et déborde du bord droit : la ligne de départ.
- Pas de dégradé, pas de reflet, pas d’ombre. Lisible à 29 px.

### 9.3 Icônes d’interface

- Grille de 24 px, trait de 2 px, une seule terminaison de trait dans tout le jeu d’icônes (droite de préférence, pour rester cohérent avec les lettres du display).
- Version tracée au repos, version pleine pour l’état actif.
- Base possible : Lucide ou Phosphor (licences permissives), retouchées pour respecter les règles ci-dessus. Les icônes propres au sport (haltère, chronomètre, chaussure, piste) sont dessinées sur mesure, dans le même style.
- Jamais d’emoji dans l’interface.
- Toute icône seule porte un libellé d’accessibilité. Les icônes d’action importantes sont accompagnées d’un texte.

---

## 10. Imagerie et visualisation de données

### 10.1 Photographie

Réservée à l’onboarding et au marketing. Aucune photo dans les écrans fonctionnels.

- Lumière naturelle, couleurs non retouchées, aucun filtre ni duotone.
- Personnes réelles, en effort réel : visages non posés, vêtements ordinaires.
- Cadrage large, avec le lieu (salle de quartier, parc, route) plutôt que des gros plans de muscles.
- Pas de banque d’images générique.
- Si du texte est posé sur une photo, il l’est sur une bande Marine pleine, jamais directement sur l’image.

### 10.2 Illustration

Pas d’illustration décorative. Le langage graphique est celui du marquage : lignes, schémas de terrain, couloirs. Deux couleurs maximum par schéma (Craie et Marine, ou Blanc et Bleu court).

### 10.3 Graphiques

- Courbe de 2,5 px en Bleu court. Période précédente en pointillé Ardoise de 1,5 px.
- Trois lignes de repère maximum, en Craie. Axes en légende 12 Ardoise.
- Valeur finale étiquetée directement sur la courbe, pas de légende séparée quand il y a une seule série.
- Record : losange Jaune balise cerné de 2 px Marine.
- Les histogrammes partent toujours de zéro. Les courbes peuvent ne pas partir de zéro, à condition que l’axe soit clairement gradué.
- Pas de camembert, pas d’anneau, pas de 3D, pas de dégradé de remplissage.

---

## 11. Mouvement et retour haptique

### 11.1 Principes

- Le mouvement répond à un geste de l’utilisateur ou montre un changement d’état. Il ne décore pas.
- Aucune animation d’apparition automatique sur les sections, aucun survol animé sur chaque carte.
- Un seul moment orchestré : **le tracé de la ligne de départ** quand on touche « Commencer la séance ». Un trait jaune se dessine de gauche à droite en 240 ms, puis l’écran de séance apparaît. Le même trait sert d’indicateur de chargement.

### 11.2 Durées et courbes

| Jeton | Durée | Usage |
|---|---|---|
| appui | 100 ms | Retour visuel sur un bouton pressé |
| rapide | 160 ms | Changement d’état, sélection, bascule |
| standard | 240 ms | Transitions d’écran, ligne de départ |
| lent | 360 ms | Feuilles modales |

Courbes : entrée `cubic-bezier(0.2, 0, 0, 1)`, sortie `cubic-bezier(0.4, 0, 1, 1)`.

### 11.3 Mouvement réduit

Si l’utilisateur a activé la réduction des animations, le tracé de la ligne de départ devient un fondu de 160 ms, les transitions d’écran deviennent des fondus.

### 11.4 Haptique

| Événement | Retour |
|---|---|
| Série validée | Impact moyen |
| Record battu | Double impact court |
| Fin du repos | Trois impacts légers espacés |
| Compte à rebours (3, 2, 1) | Un impact léger par seconde |
| Erreur de saisie | Notification d’avertissement |

Le son est désactivé par défaut. Un bip discret de fin de repos est proposé en option.

---

## 12. Voix et rédaction

### 12.1 Principes

- Tutoiement, phrases courtes, verbes d’action.
- Boutons à l’infinitif : Commencer la séance, Valider la série, Enregistrer.
- Un même geste porte toujours le même nom : le bouton « Valider la série » produit la confirmation « Série validée ».
- Aucun point d’exclamation, aucun emoji, aucune formule creuse.
- On donne le fait, puis ce qu’on peut faire.
- Les erreurs expliquent ce qui s’est passé et comment corriger, sans s’excuser.

### 12.2 Exemples

| Contexte | À éviter | À écrire |
|---|---|---|
| Fin de séance | Bravo champion, tu as tout déchiré ! | Séance terminée. 52 min, 14 séries. |
| Record | Nouveau record, tu es une machine ! | Record sur le squat : 100 kg × 5. |
| Inactivité | Oups, tu nous manques ! Ne lâche rien ! | Aucune séance depuis 6 jours. Reprendre le plan ? |
| Erreur de synchronisation | Oups, quelque chose s’est mal passé | La séance n’est pas synchronisée. Elle est gardée sur ton téléphone. Réessayer. |
| État vide | Rien à voir ici ! | Aucune séance enregistrée. Crée une séance ou choisis un plan. |
| Permission de localisation | Autoriser la localisation ? | Foulée utilise ta position pour tracer ta course et mesurer la distance. Elle n’est pas utilisée en dehors des séances. |
| Suppression | Êtes-vous sûr ? | Supprimer cette séance ? Cette action est définitive. |
| Confirmation | Super, c’est enregistré ! | Séance enregistrée. |

### 12.3 Ce qu’on évite

Pas de culpabilisation autour des séries de jours consécutifs, pas de comparaison avec d’autres utilisateurs par défaut, pas de promesses de résultat. L’app informe, elle ne juge pas.

---

## 13. Accessibilité

- **Contraste** : voir section 5.3. Jamais en dessous de 4,5:1 pour du texte courant.
- **Cibles tactiles** : 48 × 48 px minimum, 56 px en séance.
- **Couleur** : aucune information portée par la couleur seule. États toujours doublés d’une icône et d’un texte. Zones d’effort étiquetées.
- **Texte** : taille système prise en charge jusqu’à 200 %, chiffres de séance plafonnés à 130 %.
- **Lecteurs d’écran** : étiquettes complètes et naturelles. Exemple : « Série 3 sur 4, 80 kilos, 8 répétitions ». L’ordre de lecture suit l’ordre visuel.
- **Mouvement** : réduction des animations respectée (section 11.3).
- **Focus clavier** visible partout, avec anneau marine de 2 px.
- **Plein soleil** : texte principal en Marine sur Blanc, graisse 400 minimum, aucune information essentielle en légende de 12 px.
- **Usage à une main** : toutes les actions de séance dans le tiers bas de l’écran.

---

## 14. Mode sombre

Le mode sombre n’est pas une inversion mécanique. Il est construit à part et suit le réglage du système. L’écran de séance propose une option « Toujours sombre pendant la séance », utile en salle.

| Jeton | Clair | Sombre |
|---|---|---|
| fond | `#EEF1F6` Dalle | `#0B1433` |
| surface | `#FFFFFF` | `#141E45` |
| surface élevée | `#FFFFFF` | `#1D2A5C` |
| filet | `#D5DAE5` Craie | `#2B3A75` |
| texte | `#0D1B4C` Marine | `#F2F5FF` |
| texte secondaire | `#5B6478` Ardoise | `#A6B0D0` |
| action | `#2347D6` Bleu court | `#7C95FF` |
| texte sur action | `#FFFFFF` | `#0D1B4C` |
| marqueur | `#FFD60A` Jaune balise | `#FFD60A` (inchangé) |
| erreur | `#D1273B` | `#FF6B7D` |
| succès | `#187A41` | `#4FD18B` |

Règles :

- La hiérarchie des surfaces se fait par la clarté, pas par l’ombre.
- Le jaune ne change pas. Il est utilisé seul uniquement sur surfaces sombres ou bleues, et avec contour marine sur surfaces claires.
- Les photos ne sont pas assombries.
- Ratios en sombre : texte 16,6:1, texte secondaire 8,4:1, action 6,5:1, marine sur action 6,0:1.

---

## 15. Jetons de design (CSS)

À adapter vers les formats natifs (Swift, Kotlin, Figma Variables).

```css
:root {
  /* Couleurs de base */
  --bleu-court: #2347D6;
  --bleu-appui: #1A38B0;
  --marine: #0D1B4C;
  --jaune-balise: #FFD60A;
  --dalle: #EEF1F6;
  --blanc: #FFFFFF;
  --craie: #D5DAE5;
  --ardoise: #5B6478;
  --rouge-piste: #D1273B;
  --vert-gazon: #187A41;

  /* Rôles (mode clair) */
  --fond: var(--dalle);
  --surface: var(--blanc);
  --filet: var(--craie);
  --texte: var(--marine);
  --texte-2: var(--ardoise);
  --action: var(--bleu-court);
  --sur-action: var(--blanc);

  /* Zones d'effort */
  --zone-1: #C9D5F7;
  --zone-2: #93A9EF;
  --zone-3: #5B7BE6;
  --zone-4: #2347D6;
  --zone-5: #0D1B4C;

  /* Typographie */
  --font-display: "Big Shoulders Display", "Arial Narrow", sans-serif;
  --font-texte: "Public Sans", system-ui, sans-serif;

  /* Espacement (base 4) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-12: 48px; --sp-16: 64px;

  /* Rayons */
  --r-xs: 4px; --r-s: 8px; --r-m: 12px; --r-l: 20px; --r-full: 999px;

  /* Ombre unique (feuilles modales) */
  --ombre-feuille: 0 -8px 24px rgba(13, 27, 76, 0.12);

  /* Mouvement */
  --dur-appui: 100ms;
  --dur-rapide: 160ms;
  --dur-standard: 240ms;
  --dur-lent: 360ms;
  --ease-entree: cubic-bezier(0.2, 0, 0, 1);
  --ease-sortie: cubic-bezier(0.4, 0, 1, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --fond: #0B1433;
    --surface: #141E45;
    --filet: #2B3A75;
    --texte: #F2F5FF;
    --texte-2: #A6B0D0;
    --action: #7C95FF;
    --sur-action: #0D1B4C;
    --zone-1: #34478F;
    --zone-2: #4F69C9;
    --zone-3: #7C95FF;
    --zone-4: #B3C2FF;
    --zone-5: #F2F5FF;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-standard: 160ms; --dur-lent: 160ms; }
}
```

---

## 16. Liste de contrôle avant validation d’un écran

1. Y a-t-il un seul élément dominant, et est-ce le bon ?
2. Y a-t-il une seule action principale, dans la zone du pouce ?
3. Tout le texte est-il aligné sur la même marge ?
4. Les contrastes respectent-ils les seuils de la section 5.3 ?
5. Les cibles tactiles font-elles au moins 48 px (56 px en séance) ?
6. La couleur est-elle doublée d’une icône ou d’un texte partout où elle porte du sens ?
7. Le jaune est-il toujours accompagné de marine sur fond clair, et sous 3 % de la surface ?
8. Y a-t-il plus d’une carte, une ombre grise, un dégradé, un emoji, une majuscule espacée ? Si oui, on retire.
9. Chaque libellé dit-il exactement ce qui va se passer, avec le même mot dans tout le parcours ?
10. Peut-on retirer un élément sans perdre d’information ? Si oui, on le retire.

---

## 17. À valider et suite

**À valider avant production**

- Sport ciblé, public et nom de marque (recherche d’antériorité à faire).
- Rendu réel de Big Shoulders Display en tabulaire sur iOS et Android. Prévoir un plan B (chiffres à largeur fixe) si besoin.
- Lisibilité en plein soleil sur appareil réel, avec le bleu court et le jaune.
- Test de la saisie de série à une main, avec des mains moites, auprès de 5 pratiquants.
- Licences des polices (OFL : intégration dans une app autorisée) et du jeu d’icônes retenu.

**Livrables suivants possibles**

1. Bibliothèque de composants dans Figma avec variables de couleur, de typo et d’espacement.
2. Maquettes haute fidélité des 3 écrans clés (accueil, séance, progrès) en clair et en sombre.
3. Prototype de la saisie de série, pour tester le geste avant de développer.
4. Guide de marque d’une page (logo, couleurs, ton) pour l’équipe marketing.
