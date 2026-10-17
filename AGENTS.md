# AGENTS.md

Expo SDK 57 + React Native + TypeScript (strict) training app. Code and comments in English, but the product, UI copy, and specs are French ("AppSport Local").

## Do not trust your Expo training data

Expo ships breaking changes every SDK release. Before using any Expo/EAS/React Native API, check the installed version and read the versioned docs — do not answer from memory.

- SDK version lives in the `expo` dependency in `package.json` (currently `~57`).
- Versioned docs: https://docs.expo.dev/versions/v57.0.0/
- Full index with common-LLM-misconception corrections: https://docs.expo.dev/llms.txt

## Commands

This is an npm project (`package-lock.json`, no `bun.lock`) — use `npx`, not `bunx`.

```bash
npx expo install <package>   # always, instead of npm/yarn/bun add — resolves SDK-compatible versions
npx expo start               # dev server
npx tsc --noEmit             # typecheck — the only configured verification step
npx expo-doctor              # diagnose dependency/config problems
npx expo install --fix       # fix incompatible package versions
```

- No lint or test setup exists: no ESLint config, no test runner, no `lint`/`test` scripts. `npx expo lint` will prompt to install `eslint-config-expo` first — don't assume it works out of the box.
- Run `npx tsc --noEmit` before declaring any task done.

## Architecture

- Entrypoint: `index.ts` calls `registerRootComponent(App)`; the app lives in `App.tsx` (`package.json` `"main": "index.ts"`).
- Navigation is **React Navigation** (`@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`), **not** Expo Router. Bottom tabs (`src/navigation/BubbleTabBar.tsx` + `RootNavigator.tsx`): `Main` (accueil) and `Seance` (séances, groupées par split). A root stack pushes `SessionEditor` (création/édition) and `LiveWorkout` (séance en cours). There is no `src/app/` route tree — do not add Expo Router or a file-based routes directory. There is **no standalone exercise-catalogue screen**: exercises are only browsed via the picker inside the session editor (`ExerciseSearchList`).
- Folders live under `src/`: `components/` (shared UI: `ExerciseSearchList`, `ActionSheet`, the exercise/plate sheets, and the `ui/` design-system primitives — all modals close on a tap outside, bottom sheets use `Sheet`), `domain/` (business rules, e.g. `workoutRules.ts`), `lib/` (pure helpers), `navigation/`, `screens/`, `services/`, `data/`, `theme/` (`colors.ts` + `tokens.ts`). Light app preferences use `expo-sqlite/kv-store` via `src/services/preferences.ts` (no schema change): active group, and groups removed from the home page (`getHiddenGroupIds` / `setGroupHidden`, toggled from a group's « ⋯ » menu in the Séance tab — which also renames and deletes a group with `deleteSessionGroup`).

## Data & domain

- `docs/CDC.md` — product spec (French, v2.0): dark high-contrast theme, palette `#121218` bg / `#00E676` accent / `#00B0FF` secondary / `#FF3D00` alert; rest-time and set rules keyed on `is_poly`; program-generation rules; 4 modules (Onboarding, Programme, Live Workout, Stats). Product source of truth — keep user-facing strings and domain terms in French.
- `docs/SCHEMA.sql` — SQLite schema source of truth: `ACCOUNTS`, `EXERCISES`, `SESSION_GROUPS`, `PROGRAMS`, `WORKOUT_EXOS`, `LOGS_SESSION`, `LOGS_SETS`. Persistence is SQLite via `expo-sqlite` (registered as a config plugin in `app.json`); keep the schema and this file in sync.
- `src/services/database.ts` — opens the DB, runs versioned migrations (`PRAGMA user_version`, currently **v7**) and seeds the exercise catalogue. Bump `DATABASE_VERSION` and add a migration branch for each change; any pre-v3 DB drops/recreates `EXERCISES`. Séances are grouped in `SESSION_GROUPS` (splits like PPL/Maison) via `PROGRAMS.group_id`. `WORKOUT_EXOS` stores the rep range as `reps_min`/`reps_max` (double progression) and one weight per set as JSON in `set_weights` (set 1 applies to all unless overridden). A finished workout is journalled by `saveWorkoutSession()` (LOGS_SESSION with `program_id` + LOGS_SETS per set) and the exercise plan is updated in place, so weights carry over to the next session.
- `src/data/exercises.seed.json` — 1 324 exercises imported from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (MIT). `SEED_EXERCISES` in the service wraps it.
  - **Derived fields, not from the source:** `nom_fr` is an auto-generated best-effort translation (the dataset ships English names + French *instructions* only), and `is_poly` comes from an isolation-keyword heuristic. Don't treat either as authoritative.
- `src/data/exerciseImages.ts` — generated map `filename → require()` for the 1 324 local 180×180 thumbnails in `assets/exercises/` (~12 MB, image © Gym visual). `EXERCISES.image` holds the filename key. Animated GIFs (122 MB) are **not** bundled and are currently not displayed anywhere (the old exercise-detail view was removed).
- `docs/TESTING.md` — how to run the app on a phone (Expo Go, dev build) and surface what works/fails.
- `src/theme/colors.ts` — official palette (`#121218` bg, `#00E676` accent, `#00B0FF` secondary, `#FF3D00` alert) plus derived neutrals. Use these instead of hard-coded colors.

## Rules

- **Every screen goes through the design system**: `src/theme/tokens.ts` (spacing, radius, typography, durations, spring) and `src/components/ui/` primitives. No hard-coded colors, radii or font sizes in screens; only the official palette from `src/theme/colors.ts`.
- Content modals are bottom sheets built on `src/components/ui/Sheet.tsx` (slide-in + spring, close on outside tap, close button, Android back). Animate with `Animated` (`Appear` for entrances, `PressableScale` for presses) — no animation library is installed.
- `ios/` and `android/` are gitignored and generated (Continuous Native Generation). Never create or hand-edit them — configure native behavior in `app.json` and config plugins.
- After adding any library with native code, the app needs a development build (`npx expo run:ios|android`, or `eas build --profile development`). EAS is not configured yet (no `eas.json`); run the CLI as `npx eas-cli@latest <command>`, not bare `eas`.
- Prefer recommended Expo modules over third-party libraries before adding dependencies.
