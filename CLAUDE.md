# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The project instructions live in `AGENTS.md` (shared with other agents) and are imported here — edit them there, not in this file:

@AGENTS.md

## Additional notes

- **Verification**: there are no tests and no linter. `npx tsc --noEmit` is the only check; run it before declaring a task done. To see a change working, run the app on a phone (`npx expo start`, Expo Go — see `docs/TESTING.md`).
- **DB version**: the authoritative version is `DATABASE_VERSION` in `src/services/database.ts` (currently 17). The version quoted in `AGENTS.md`/`README.md` may lag behind; when you add a migration, update the constant, `docs/SCHEMA.sql`, and those mentions.
- **Living docs**: `README.md` (French) is maintained as a living document — feature checklist under « État du projet », and the « Structure » tree. When a feature ships or a file is added/renamed, update the README (and `AGENTS.md` if an architectural rule changes) rather than rewriting them.
