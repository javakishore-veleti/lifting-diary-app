# OpenSpec Commands — Propose

Planning commands for this project: what was run to create the five open changes, and the CLI surface behind them. Planning only — none of these edit application code.

Schema is `spec-driven` (set in `openspec/config.yaml`), so every change carries four artifacts: `proposal.md` → `specs/<capability>/spec.md` → `design.md` → `tasks.md`.

## Slash commands used

Each of these created one change with all four artifacts. Run from the repository root.

```
/opsx:propose DB Setup Drizzle ORM for this codebase
/opsx:propose UI setup shadcn ui components in this project
/opsx:propose Setup Clerk Auth mechanism for this application
```

Two further changes were created during a follow-up conversation rather than from a single prompt:

```
/opsx:propose app specific postgres auth tables for signup, signin and reset password, used when the Clerk feature toggle is false
/opsx:propose local Docker Postgres under DevOps/Local with up, down and status scripts
```

One update was invoked and produced **no edits** — the request turned out to be a new change rather than a revision to an existing one:

```
/opsx:update Update the Clerk proposal to have a feature toggle
```

## What each command produced

| Command intent | Change created | Tasks |
|---|---|---|
| Drizzle ORM + Postgres | `add-drizzle-db-setup` | 45 |
| shadcn/ui components | `add-shadcn-ui-foundation` | 50 |
| Clerk auth enforcement | `add-auth-route-protection` | 47 |
| App-owned credentials auth | `add-credentials-auth-provider` | 82 |
| Local Docker stack | `add-local-docker-devops` | 47 — ✓ implemented and archived |

`add-auth-route-protection` is named for what it does rather than "add Clerk", because Clerk was already installed and wired up before planning began. The change adds the authorization layer — default-deny route protection, dedicated auth routes, and a server-side identity accessor.

## Revisions applied after the fact

`add-drizzle-db-setup` was revised from Neon serverless Postgres to local Postgres:

- Driver changed to `node-postgres`; `@neondatabase/serverless` is installed but imported nowhere, so adopting a managed host later is wiring plus an environment variable.
- `db.transaction()` became available, which `add-credentials-auth-provider` depends on.
- Neon activation deferred to a future change.

`add-credentials-auth-provider` was reconciled to match — three places had asserted Neon's transaction limitation and now read the other way round.

## Underlying CLI commands

The slash commands wrap these. Useful directly when inspecting or scripting.

### Discover context and existing work

```bash
openspec context --json           # resolve which OpenSpec root is in effect
openspec list                     # active changes, most recently modified first
openspec list --json              # same, machine-readable
openspec list --specs             # main specs (empty until a change is archived)
openspec schemas --json           # available workflow schemas
```

### Create a change

```bash
openspec new change "<name>"
openspec new change "<name>" --schema "<schema-name>"
openspec new change "<name>" --description "<text>"
```

### Drive artifact creation

```bash
openspec status --change "<name>" --json
openspec instructions proposal --change "<name>" --json
openspec instructions specs    --change "<name>" --json
openspec instructions design   --change "<name>" --json
openspec instructions tasks    --change "<name>" --json
```

`status --json` reports each artifact's `status` and its `requires` edges. Build order follows the edges, not the status: an artifact reading `done` still lists what it depends on, and writing `tasks.md` early marks `tasks` done while `specs` may never have been written.

Write artifacts to the paths in `artifactPaths.<id>.resolvedOutputPath`. For glob artifacts such as `specs/**/*.md`, that value is the pattern — pick a concrete file inside it.

### Validate

```bash
openspec validate "<name>" --strict
openspec validate --changes --strict     # every change
openspec validate --all --strict         # changes and specs
```

Strict mode catches a `## Purpose` section under 50 characters, scenarios written with three `#` instead of four (which fail silently otherwise), and requirements with no scenario.

### Inspect

```bash
openspec show "<name>"
openspec status --change "<name>"
openspec view                     # interactive dashboard
openspec doctor                   # relationship health for the resolved root
```

## Verify everything

```bash
openspec validate --changes --strict   # every active change
openspec validate --specs --strict     # every main spec
openspec validate --all --strict       # both
```

Prefer these over a hardcoded loop over change names. An archived change is no longer a valid item — `openspec validate "add-local-docker-devops"` now fails with *Unknown item* — so any list written by hand breaks the first time something is archived.

## Conventions worth keeping

- **Never commit a credential to an artifact.** Everything under `openspec/changes/` is version-controlled, so a connection string in `tasks.md` is a connection string in git history. Artifacts reference placeholders; real values belong in `.env.local`, which `.gitignore` already covers via `.env*`.
- **Scenarios need exactly four hashes.** `#### Scenario:` is parsed; `### Scenario:` is ignored without error.
- **A change with zero spec deltas fails validation** unless its `.openspec.yaml` sets `skip_specs: true`. Use that only for genuine no-behavior-change work — tooling, refactors, docs. Do not invent a requirement to satisfy the validator.
- **`design.md` is conditional** in this schema. Write it for a new dependency, a new architectural pattern, a data model, or security and migration complexity. All five changes here qualified.
- **Ask before proposing when the answer changes scope.** Each of these changes had one or two decisions — database host, dark-mode strategy, protected surface — that would have produced materially different plans.
