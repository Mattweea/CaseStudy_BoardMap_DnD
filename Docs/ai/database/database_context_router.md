# Database Context Router

## Purpose

Route SQLite schema, migration, connection, repository, and relational-persistence work without conflating it with JSON battle-map snapshots or process-local state.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [SQLite and migration contract](sqlite_and_migration_contract.md) | Database paths, connection pragmas, migration creation/application/rollback, checksums, schema changes, repositories, transactions, test databases, or recovery | State that remains solely in memory or in the battle-map JSON snapshot |

## Cross-context routes

- Add [Backend](../backend/backend_context_router.md) when persisted data is read or mutated through services, authentication, APIs, or SSE.
- Add [Operations](../operations/operations_context_router.md) for environment configuration, database commands, backups, reset, deployment, or startup behavior.
- Add [Gameplay](../gameplay/gameplay_context_router.md) when schema or repository changes alter roster, identity, token, or other domain meaning.
- Add [Developer Workflows](../developer_workflows/developer_workflows_context_router.md) for a material schema, compatibility, or migration behavior change requiring an OpenSpec delta.

## Maintenance rule

This router owns relational persistence and schema-evolution invariants. Backend owns service and transport behavior; Operations owns how database commands and paths are used; capability requirements remain in OpenSpec.
