# Documentation Maintenance Workflow

## Purpose

Provide a repeatable workflow for evolving `Docs/ai` without losing content, breaking routes, or moving routing responsibility into `AGENTS.md`.

## Before changing documentation

1. Start from [the macro-router](../documentation_context_router.md).
2. Follow every applicable route and read the owning domain's leaves.
3. Identify the canonical owner of every affected artifact.
4. Search for links, paths, scripts, and references with `rg`.
5. Decide whether the change affects content, topology, or both.
6. Identify rules, examples, warnings, and historical evidence that must be preserved.

## Create

1. Confirm an existing leaf cannot own the reusable rule without mixing triggers.
2. Select one owning router.
3. Create the smallest independently selectable leaf.
4. Add a real Markdown link and precise read/skip trigger to the owner.
5. Update ancestors only when a branch or top-level trigger changes.
6. Add cross-context links without copying the leaf's rules.

Never add leaf paths to `AGENTS.md`.

## Move or rename

1. Preserve content before changing the path.
2. Update the owning router and all internal references.
3. Update hardcoded paths in scripts or checks.
4. Update ancestor routers if ownership changes.
5. Search for the old path and basename.
6. Confirm the diff represents the intended move and edits.

Do not leave compatibility copies unless a real external consumer requires them.

## Split or merge

Split by consultation trigger, not line count. Inventory every heading block and map it to exactly one destination. Preserve warnings, examples, and protected contract strings.

Merge only leaves with the same owner, authority, audience, lifecycle, and trigger. Remove duplicate wording while preserving unique rules.

## Delete

1. Confirm the artifact is obsolete rather than merely inconvenient.
2. Move reusable rules or forensic evidence when still valuable.
3. Remove owner and cross-context links.
4. Search for stale references.
5. Run the routing validator to prove no artifact became orphaned.

## Verification

Run:

```bash
npm run docs:check
git diff --check
```

For moves, splits, and merges, add a focused comparison proving protected content was preserved. Compare hashes for binary references.

## Completion checklist

- Every artifact has one canonical owner.
- Every artifact is reachable from the macro-router.
- Every child has a precise consultation trigger.
- Cross-context routes do not duplicate rules.
- Historical evidence is isolated and labeled.
- Old paths and hardcoded references are gone.
- Documentation validation passes.
- `AGENTS.md` still points only to the macro-router.
