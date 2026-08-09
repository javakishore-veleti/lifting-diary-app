# OpenSpec Commands — Archive

Archiving folds a completed change's delta specs into `openspec/specs/` and moves the change out of the active list into `openspec/changes/archive/`. It is the step that turns a proposal into the project's standing specification.

Companion to `OpenSpec-Commands-Propose.md` (planning) and `OpenSpec-Commands-Apply.md` (implementation).

## Current state

**One change archived** (2026-08-08). `openspec/specs/` now holds its capability.

| Archived | Capability created |
|---|---|
| `archive/2026-08-08-add-local-docker-devops/` | `local-dev-environment` (6 requirements, 21 scenarios) |

| Active change | State | Archivable |
|---|---|---|
| `add-credentials-auth-provider` | 0/82 tasks | No |
| `add-drizzle-db-setup` | 0/45 tasks | No |
| `add-auth-route-protection` | 0/47 tasks | No |
| `add-shadcn-ui-foundation` | 0/50 tasks | No |

Nothing else is archivable until its tasks are complete.

## Slash commands

```
/opsx:archive add-local-docker-devops     # archive one completed change
/opsx:bulk-archive                        # archive several completed changes at once
/opsx:sync                                # fold delta specs into main specs WITHOUT archiving
```

`/opsx:sync` is the one worth knowing about: it updates `openspec/specs/` from a change's deltas while leaving the change active. Useful when a change is partly implemented and you want the specs to reflect reality before the whole thing is done.

## CLI commands

### Archive a change

```bash
openspec archive "<change-name>"                  # interactive, validates first
openspec archive "<change-name>" --yes            # skip confirmation prompts
openspec archive "<change-name>" --json           # non-interactive, JSON output
openspec archive "<change-name>" --skip-specs     # move the change, do NOT touch main specs
openspec archive "<change-name>" --no-validate    # skip validation (not recommended; prompts)
```

Flags combine, e.g. `openspec archive "<name>" --yes --json` for scripted use.

### Inspect before archiving

```bash
openspec status --change "<name>"         # confirm all tasks are checked off
openspec validate "<name>" --strict       # confirm artifacts still validate
openspec show "<name>"                    # read the change back
openspec list                             # task counts across all changes
```

### Inspect after archiving

```bash
openspec list --specs                              # main specs, populated by archiving
openspec show "<spec-id>"                          # read one main spec
openspec validate "<spec-id>" --type spec --strict # validate one main spec
openspec validate --specs --strict                 # validate every main spec
openspec view                                      # interactive dashboard
```

The `openspec spec list` / `spec show` / `spec validate` subcommands still work but print a deprecation warning. Use the verb-first forms above. `--type spec` disambiguates when a change and a spec share a name.

## What archiving actually does

1. Validates the change (unless `--no-validate`).
2. Applies each delta under `changes/<name>/specs/<capability>/spec.md` to `openspec/specs/<capability>/spec.md` — creating the main spec if it does not exist, or merging `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED` sections into it if it does.
3. Moves `openspec/changes/<name>/` to `openspec/changes/archive/<name>/`.
4. Drops the change from `openspec list`.

For a **new** capability, the delta's `## Purpose` section is copied into the main spec it creates. A delta missing that section leaves the new main spec with a `TBD ... Update Purpose after archive` placeholder to fill in by hand — which is why `validate --strict` rejects a Purpose under 50 characters.

For an **existing** capability, the delta's Purpose is ignored; the main spec already has one. Changing it means editing `openspec/specs/<capability>/spec.md` directly.

## When to use `--skip-specs`

Only when a change genuinely produced no spec-level behaviour — pure tooling, refactors, or docs. It moves the change without touching main specs.

**None of these changes qualify.** `add-local-docker-devops` looked like pure infrastructure, but it declared a real capability with observable behaviour that later work depends on — and archiving it with `--skip-specs` would have silently dropped `local-dev-environment` from `openspec/specs/`. The same reasoning applies to the four still active.

Use `--skip-specs` only for a change whose `.openspec.yaml` sets `skip_specs: true`, meaning it never had deltas to apply.

## Archive order

Archiving does not enforce the dependency chain — it is a bookkeeping operation, not a build. But archiving in implementation order keeps `openspec/specs/` coherent as it grows:

```
add-local-docker-devops        →  specs/local-dev-environment/          ✓ archived
add-shadcn-ui-foundation       →  specs/design-system/, specs/theming/
add-auth-route-protection      →  specs/access-control/
add-drizzle-db-setup           →  specs/data-persistence/, specs/training-log/
add-credentials-auth-provider  →  specs/credentials-auth/, specs/auth-provider-selection/
```

Nine capabilities across five changes; one archived, eight pending. No two changes declare the same capability, so no delta merges into a spec another change created — every archive here creates new main specs rather than modifying existing ones. That makes the order low-risk.

## Before archiving a change

1. `openspec status --change "<name>"` — every task checked.
2. `openspec validate "<name>" --strict` — artifacts still valid.
3. `/opsx:verify <name>` — implementation actually matches the specs. Worth running: verifying `add-local-docker-devops` surfaced a column-alignment defect that the checked-off task list did not.
4. Commit the implementation. Archiving moves planning files; it does not commit code.

## What the first archive actually did

`/opsx:archive add-local-docker-devops` ran on 2026-08-08. The slash-command workflow differs from the bare CLI: it syncs the delta into main specs itself, verifies the merge, and only then moves the change — so `openspec archive` was never invoked.

Sequence:

```bash
openspec instructions archive --change "add-local-docker-devops" --json  # advisory; returned no context
openspec status --change "add-local-docker-devops" --json                # 4/4 artifacts done
# tasks.md: 47/47 complete
openspec instructions specs --change "add-local-docker-devops" --json    # required before writing main specs
# sync: created openspec/specs/local-dev-environment/spec.md from the delta
# verify: 6/6 requirements, 21/21 scenarios, bodies byte-identical
mv openspec/changes/add-local-docker-devops \
   openspec/changes/archive/2026-08-08-add-local-docker-devops
openspec validate --all --strict                                          # 5 passed, 0 failed
```

The delta was ADDED-only, so the merge was a straight creation: `## ADDED Requirements` became `## Requirements`, and `## Purpose` carried over unchanged. A change with MODIFIED or REMOVED sections against an existing main spec is a genuine merge and warrants closer reading of the result.

Verifying the merge **before** the move matters: the move is what makes a bad sync expensive to unpick, since `changeRoot` is no longer where the tooling expects it.

## Undoing an archive

There is no `unarchive` command. Reverse it by moving the directory back:

```bash
mv openspec/changes/archive/<name> openspec/changes/<name>
```

The spec merge is **not** undone by that move — `openspec/specs/` keeps whatever the archive wrote. Reverting that means editing the main spec by hand or reverting the commit. Committing before archiving makes this a `git revert` rather than manual surgery.

## Notes

- `openspec instructions archive --change "<name>" --json` exists but currently returns only `changeName` and `root` for this project, with no instruction body. Use `openspec archive --help` for the authoritative flag list.
- Every command above accepts `--store <id>` when the work lives in a registered standalone OpenSpec repo. This project uses the local `openspec/` root, so the flag is unnecessary here.
- `openspec view` gives an interactive dashboard of specs and changes, useful for seeing the archive's effect.
