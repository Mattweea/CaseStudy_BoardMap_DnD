# Developer Workflows Context Router

## Purpose

Route planning and delivery workflows that coordinate changes across technical and gameplay domains.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [OpenSpec spec-driven workflow](openspec_spec_driven_workflow.md) | OpenSpec setup or commands, deciding whether a change needs a spec, proposals, capability specs, design, tasks, applying, verifying, syncing, or archiving | Small work already covered by an approved change or work with no planning/specification impact |

## Cross-context routes

OpenSpec routes are always cumulative with the implementation domains selected by the [documentation macro-router](../documentation_context_router.md). A proposal does not replace frontend, backend, gameplay, operations, or documentation-governance contracts.

## Maintenance rule

This router owns the repository's planning and delivery workflow. Observable capability requirements live under `openspec/specs` when OpenSpec is present; reusable implementation conventions remain under `Docs/ai`.
