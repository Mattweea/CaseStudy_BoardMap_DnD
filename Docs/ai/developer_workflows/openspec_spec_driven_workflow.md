# OpenSpec Spec-Driven Workflow

## Purpose

Define how this repository uses OpenSpec without duplicating the `Docs/ai` context system or confusing planned behavior with current implementation.

## Why it fits this project

OpenSpec is appropriate for this project because changes frequently cross React UI, Fastify APIs, authorization, SSE, persistence, and gameplay rules. Reviewable behavior scenarios reduce ambiguity before those shared contracts are edited.

The repository uses two complementary knowledge systems:

| System | Owns | Does not own |
|---|---|---|
| `openspec/specs` | Canonical observable behavior grouped by product capability | Internal architecture, coding conventions, or operational instructions |
| `openspec/changes/<name>` | A proposed delta: why, changed requirements, design decisions, and implementation tasks | Current behavior before the change is applied |
| `Docs/ai` | Architecture, domain invariants, implementation boundaries, operations, and context routing | A duplicate catalog of every user-facing requirement |

When an OpenSpec requirement and a `Docs/ai` convention interact, satisfy both. If they conflict, stop and resolve ownership: product intent belongs in the spec; implementation policy belongs in `Docs/ai`.

## Change gate

Create or use an OpenSpec change for:

- a new user-visible capability;
- a material modification or removal of observable behavior;
- breaking API, shared-state, persistence, authorization, or compatibility work;
- high-risk cross-domain architecture where alternatives and rollout need review.

A new change is normally unnecessary for:

- documentation-only or copy-only updates;
- purely cosmetic adjustments;
- dependency and developer-tool maintenance;
- mechanical refactors with no observable behavior change;
- a focused bug fix that restores behavior already stated by a canonical spec.

For a planning-worthy refactor or tooling change with no requirement delta, set `skip_specs: true`; never invent product requirements solely to satisfy validation.

## Sources and states

- `openspec/specs/<capability-path>/spec.md` describes the accepted capability contract.
- `openspec/changes/<change>/specs/.../spec.md` is a delta for one proposed change.
- An active delta becomes authoritative for implementation only when that exact change has been reviewed and selected for Apply.
- Code remains the evidence of what currently runs. A mismatch between code and canonical specs is a defect or an unapplied/stale contract, not permission to silently rewrite either side.
- Archived changes are historical evidence of why the canonical specs evolved; canonical specs remain the concise current contract.

## Core lifecycle

### 1. Explore

Use Explore when the problem, scope, alternatives, or affected capabilities are unclear. It is read-only by default and must not edit implementation code. End with the problem, options, open questions, and a recommended next step.

### 2. Propose

Propose creates `openspec/changes/<kebab-case-name>/` and the standard spec-driven artifacts:

```text
proposal.md
specs/<capability-path>/spec.md
design.md                 # only when technical decisions need it
tasks.md
```

`proposal.md` explains why and scope. Delta specs define observable behavior. `design.md` records consequential technical decisions and trade-offs. `tasks.md` maps the reviewed plan to implementation and verification.

Propose stops before code. Review artifacts in this order: proposal, specs, design, tasks.

### 3. Review

Before Apply, confirm:

- scope and non-goals are explicit;
- every new or modified capability has the correct delta;
- requirements use normative language and testable scenarios;
- security, authorization, failure, compatibility, and migration cases are covered where applicable;
- design respects the applicable `Docs/ai` contracts;
- tasks trace to requirements and include tests, documentation impact, and verification;
- no task introduces behavior absent from the proposal/specs.

Run:

```bash
openspec validate <change-name> --strict --no-interactive
```

### 4. Apply

Implement tasks in dependency order. Read the complete change and all routed `Docs/ai` context before editing code.

- Keep the implementation within the reviewed scope.
- Add or update automated tests for each requirement scenario where programmatic verification is practical.
- Cover the intended behavior and the most likely adjacent regression.
- Update reusable `Docs/ai` conventions in the same change when architecture or operating rules change.
- Check a task only after implementation and its defined verification succeed.
- If implementation reveals a changed requirement or design decision, update and re-review the artifacts instead of allowing code to drift from the plan.

### 5. Verify

Verification compares code and evidence against proposal, specs, design, and tasks. It is separate from structural OpenSpec validation.

Verify:

- completeness: every requirement and task is implemented;
- correctness: scenarios, errors, permissions, and edge cases behave as specified;
- coherence: implementation follows the reviewed design and routed conventions;
- regression safety: affected tests, build, documentation validation, and adjacent flows pass.

Use the optional OpenSpec Verify skill when installed. Otherwise perform and report the same comparison explicitly. A green build alone is not sufficient.

### 6. Sync and archive

Archive only after implementation and verification are complete. Sync implemented deltas into canonical specs, validate the result, then move the change under the dated archive.

Do not archive to hide incomplete tasks, unresolved warnings, or a mismatch between specs and code. Do not sync an unimplemented requirement into canonical specs.

## Capability spec rules

- Organize specs by stable product capability, using kebab-case paths.
- Describe observable behavior, inputs, outputs, errors, security, privacy, reliability, and compatibility constraints.
- Use `SHALL` or `MUST` for normative requirements.
- Give every requirement at least one `#### Scenario` using `WHEN` and `THEN`.
- Keep internal filenames, class names, libraries, and step-by-step implementation out of specs; those belong in design/tasks or `Docs/ai`.
- A `MODIFIED` delta carries the complete surviving requirement and scenarios, not only the changed sentence.
- State reason and migration for removals.

## Tests and traceability

Requirements are acceptance contracts, not substitutes for tests. `tasks.md` must identify the verification for every changed requirement:

- backend/domain/authorization/persistence behavior requires focused automated tests;
- shared hooks, normalization, realtime reconciliation, and complex UI logic require regression tests where a runner exists;
- cosmetic-only behavior may use build plus targeted manual checks when automation has low value;
- missing test infrastructure must be reported explicitly and addressed in the change when the regression risk justifies it.

Final reporting should map completed requirements to test/build/manual evidence and name any limitation.

## Project configuration

Keep `openspec/config.yaml` concise. It should point agents to `AGENTS.md` and the documentation macro-router, require tasks to include tests and documentation impact, and require Apply to run the relevant project checks before checking tasks.

Prefer project configuration over a custom schema. Fork the built-in schema only when the team needs different artifacts or ordering, not merely extra rules.

Recommended project-level additions after the OpenSpec root is integrated:

```yaml
schema: spec-driven

context: |
  Follow AGENTS.md and start repository context selection from Docs/ai/documentation_context_router.md.
  OpenSpec owns observable capability requirements; Docs/ai owns architecture and conventions.
  The stack is React, TypeScript, Vite, Fastify, SSE, and the persistence model documented in this repository.

rules:
  specs:
    - Cover authorization, failure, compatibility, and migration scenarios when applicable.
  tasks:
    - Map every changed requirement to automated or explicitly justified manual verification.
    - Include Docs/ai impact assessment and npm run docs:check when documentation changes.

operations:
  apply:
    guidance:
      - Follow routed Docs/ai context and run the checks required by AGENTS.md before completing a task.
  archive:
    guidance:
      - Archive only after implementation-to-spec verification and successful project checks.
```

Keep the context aligned with the merged branch: if persistence or the test stack changes, update this configuration and the owning routed documentation together.

## Branch integration note

If another branch already contains `openspec/`, merge that implementation rather than initializing a second competing root. After merge:

1. inspect `openspec/config.yaml` and generated skills;
2. update generated workflow files with the installed CLI when needed;
3. add repository-specific context/rules without hand-editing generated skill bodies;
4. run `openspec validate --all --strict --no-interactive`;
5. keep OpenSpec artifacts versioned with the code they describe.
