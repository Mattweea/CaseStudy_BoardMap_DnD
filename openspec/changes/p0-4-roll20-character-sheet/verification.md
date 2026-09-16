## P0.4 verification

Date: 2026-09-16

### Automated verification

- `npm test`: 21/21 tests passed.
- `npm run build`: TypeScript project build and Vite production build passed.
- `openspec validate p0-4-roll20-character-sheet`: valid.
- Migration test applies, rolls back, reapplies, and refuses duplicate owner/campaign rows before altering the table.

### Two-browser collaboration

Verified with isolated Master and Ilthar browser contexts against a temporary migrated SQLite database:

- Different fields from the same base version returned `200` and merged (`background = Master edit`, `armorClass = 18`).
- A second stale edit to `character.name` returned `409` with current value `Ilthar Master` and current version.
- The local input `Ilthar Keyboard` remained available through a tab round trip.
- Another Adventurer is denied private sheet read/write/subscribe in the automated authorization and SSE suites.

### Persistence and portrait

- Explicit close flushed version 19.
- After a server process restart, version 19 reloaded with name, background and Armor Class intact.
- The authenticated portrait route returned `200 image/png` after restart.
- The portrait upload returned `200`, updated the connected roster via its opaque URL, and left the token image at `/media/images/ilthar.jpeg`.
- Controlled-clock tests confirm rapid patches group into one repository write and failed persistence stays dirty and retries.

### Visual review

Screenshots were captured in `tmp/p04-e2e/screenshots/` at 1440×1000 and 390×844 for all three tabs and compared to pages 1–3 of `5E_CharacterSheet_Fillable.pdf`. The later compact-window review also used the supplied Roll20 character-window screenshot as the reference for outer proportions, application chrome and coexistence with the map.

| Tab | Desktop correspondence | Narrow behavior |
| --- | --- | --- |
| Personaggio e combattimento | Two-column compact hierarchy keeps ability shields beside combat vitals, then gives narrative panels the full sheet width in the reference reading order. | Sections reflow vertically; fields and controls remain usable; no horizontal page overflow. |
| Aspetto e storia | Large asymmetric portrait, allies, backstory, additional-features and treasure panels preserve the page-two grouping. | Identity facts and panels form one reading column; portrait and upload control remain fully visible. |
| Incantesimi | Spellcasting header and levels 0–9 form a dense two-column scan with emphasized levels and slots inside the narrower window. | Header values and spell levels reflow into one column without clipped controls. |

The narrow check reported no window or document horizontal overflow and exactly one rendered tab panel. Keyboard checks covered tab switching, Escape close, focus restoration, natural focus exit from the non-modal sheet, local-value preservation and unchanged map zoom. The UI uses no PDF logo or illustration assets.

### Compact floating window review

`tmp/p04-e2e/verify-floating-window.mjs` passed against the live client and server:

- Desktop window measured 1020×760 at 1440×1000, ratio `1.342`, matching the target Roll20 proportion of about `1.35:1`.
- Pointer drag moved the window from `(210, 120)` to `(360, 195)`; `Alt+ArrowLeft` then moved it exactly 16 px.
- The stored `(344, 195)` position was restored after reload. Resizing to 900×700 clamped the window to `(20, 20)` with every edge inside the viewport.
- At 390×844 the window became a full-screen, non-draggable layout with three visible tab targets and no horizontal sheet overflow.
- The overlay uses `pointer-events: none`, the window restores `pointer-events: auto`, and a click on the exposed map reached `.app-main` while the sheet remained open.
- The character tab exposes 31 stable `data-roll-source` anchors across abilities, saving throws, skills, initiative, attacks and spell controls; no P0.5 roll command is rendered or executed.
- Screenshots: `compact-roll20-character.png`, `compact-roll20-spells.png`, and `compact-roll20-narrow.png`.
