# Documentation Governance Context Router

## Purpose

Route work about the documentation system itself without mixing structural rules with operational maintenance steps.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [Documentation structure](documentation_structure.md) | Hierarchy, router responsibilities, canonical ownership, naming, leaf granularity, cross-context links, or historical evidence | Applying an already-understood maintenance operation only |
| [Documentation maintenance workflow](documentation_maintenance_workflow.md) | Creating, moving, renaming, splitting, merging, or deleting documents; updating links; validating topology | Reading documentation without changing its content or structure |

Read both leaves when introducing a branch or materially reorganizing a domain.

## Cross-context routes

Add the router for every technical or gameplay domain whose documentation is being changed. Documentation governance defines how the graph works; domain routers own what their contracts say.

## Maintenance rule

This router owns documentation-governance rules. The [macro-router](../documentation_context_router.md) remains the only repository-wide entry point and contains only top-level triggers and global routing invariants.
