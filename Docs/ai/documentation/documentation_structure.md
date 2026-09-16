# Documentation Structure

## Purpose

Keep `Docs/ai` navigable as the project grows by giving every artifact a clear owner, a precise consultation trigger, and a reachable path from the macro-router.

## Hierarchy

```text
AGENTS.md
└── Docs/ai/documentation_context_router.md
    ├── domain context router
    │   ├── focused leaf
    │   └── nested context router
    │       └── focused leaf
    └── historical context router
        └── historical, non-authoritative evidence
```

- `AGENTS.md` defines working rules and points only to the macro-router.
- The macro-router maps top-level task areas to domain routers.
- A domain router selects focused leaves and declares cross-context dependencies.
- A nested router narrows a domain when its leaves have independently selectable triggers.
- A leaf owns reusable rules, invariants, references, or evidence for one coherent concern.

## Canonical ownership

- Every artifact has one canonical owning router.
- Cross-context links express dependency, not ownership.
- The owner defines when an artifact must be read and when it can be skipped.
- Every artifact must be reachable from the macro-router by traversing routers.
- Binary references and historical evidence follow the same reachability rule.

Choose the domain that defines a rule, not a domain that merely consumes it.

## Router design

Router filenames end in `_context_router.md`. A router contains:

1. purpose and scope;
2. explicit read triggers for every child;
3. skip conditions where over-selection is likely;
4. cumulative cross-context routes;
5. an ownership or maintenance rule.

Add a nested router when a domain has multiple independently selectable concerns or when current contracts must be isolated from historical evidence. Do not add a layer that only renames one undifferentiated leaf.

## Leaf granularity

A leaf is the smallest independently selectable context, not the smallest possible file. Split when sections differ by trigger, audience, owner, authority, lifecycle, or verification workflow. Do not split solely because a file is long.

When splitting, preserve every current rule, warning, example, and reference exactly once unless an intentional correction is part of the change.

## Naming and links

- Use lowercase `snake_case` filenames for new documentation.
- Use semantic domain folders, not `misc` or `other`.
- Name leaves after stable concerns, not tickets or temporary tasks.
- Use relative Markdown links inside the documentation graph.
- Link to a router for a whole domain and directly to a leaf only for that exact contract.
- Store dated investigations under a routed `historical/` branch.

## Historical evidence

Historical artifacts must be separated from current contracts, carry an internal non-authoritative disclaimer, state when forensic consultation is useful, and never override current documentation or observed behavior.

## Anti-patterns

- A leaf matrix in `AGENTS.md`.
- A leaf linked only from another leaf instead of its owner.
- Catch-all documents with unrelated triggers.
- One file per paragraph without an independent consultation reason.
- Duplicated rules across domains.
- Historical conclusions mixed into current contracts.
- Path changes without corresponding router, link, and validation updates.
