## P0.5 Fase B verification

Date: 2026-09-18

### Automated verification

- `npm test`: 74/74 tests passed, including 17 new tests in `test/character-sheet-roll-resolver.test.mjs` (single-value targets, hit dice, death saves, attack-roll/attack-damage split, critical declared by the client, saving-throw metadata, authorization, side effects, atomic patch failure) and the updated closed roll-target list in `test/character-sheet-roll-targets.test.mjs` (now including `attack-damage:<id>`).
- `npm run build`: TypeScript project build and Vite production build passed after every design iteration in this session.
- `npm run docs:check`: documentation routing check passed.
- `openspec validate p0-5b-sheet-roll-engine --strict`: valid, including after the mid-session redesign (dual-d20, decoupled attack damage, client-declared critical) that replaced the original single-request composite-attack design.

### Live end-to-end verification (real server, not just unit tests)

Started the actual Fastify server against the project's dev SQLite database and exercised the real HTTP API:

- Ability roll from a real authenticated session: two independent `1d20` returned, correct modifier.
- A non-owner, non-Master Adventurer's roll request on another player's sheet: rejected (`403`-equivalent message), no new log entry.
- Hit dice: rejected with a readable error when no type is chosen; after setting a type via a patch, a roll decremented `hitDice.remaining` by one through the same patch/version/SSE chain used by manual edits.
- Attack roll (`attack:<id>`): repeated until a natural 20 landed, confirmed `critical: true` on that entry and `critical: false` otherwise.
- Attack damage (`attack-damage:<id>`): rolled with `critical: true` right after a natural-20 attack roll — dice doubled (`1d6` → `2d6`, two independent faces), modifier applied once; rolled without `critical` — single die, as expected.
- Inspiration checkbox patch (`character.inspiration = true`) round-tripped as a boolean through the schema.

### Design iteration during this session

The originally proposed single-request composite attack (attack roll + damage in one log entry, client-chosen advantage/disadvantage via a pre-roll modal) was replaced mid-session, at the user's direction after reviewing a Roll20 reference, with: every `1d20` target rolling two independent dice with no pre-chosen mode; the attack roll and its damage as two separate targets/log entries; critical declared by the client on the damage request, deduced from the most recent attack-roll log entry for that same target. `specs/character-sheet-roll-actions/spec.md`, `design.md`, `proposal.md` and `tasks.md` were rewritten to match before archiving, so the archived record reflects what was actually built, not the original proposal.

### Manual scenario (task 7.4 / dual-browser)

Not independently re-run as an isolated two-browser Master+Player session in this pass; the live single-session API verification above exercises the same request/authorization/patch code paths. Archived on that basis at the user's explicit direction ("considerale concluse").
