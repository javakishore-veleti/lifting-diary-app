# OpenSpec Commands — Apply

Implementation commands for this project. **One change is implemented and archived**; four remain at 0 tasks. This is the order they should be applied in and why that order matters.

Task counts below go stale as work lands — `openspec list` is always authoritative.

Apply commands edit application code, unlike the planning commands in `OpenSpec-Commands-Propose.md`.

## Current state

| Change | Tasks | Depends on |
|---|---|---|
| `add-local-docker-devops` | ✓ 47/47 — archived 2026-08-08 | — |
| `add-drizzle-db-setup` | 0/45 | ~~`add-local-docker-devops`~~ — satisfied |
| `add-credentials-auth-provider` | 0/82 | `add-drizzle-db-setup`, `add-auth-route-protection` |
| `add-auth-route-protection` | 0/47 | — |
| `add-shadcn-ui-foundation` | 0/50 | — |

## Dependency chain

```
[add-local-docker-devops] ✓ ──▶ add-drizzle-db-setup ──▶ add-credentials-auth-provider
                                                                    ▲
add-auth-route-protection ──────────────────────────────────────────┘

add-shadcn-ui-foundation   (independent of all of the above)
```

The only hard block is already satisfied: the Docker stack is running, so `add-drizzle-db-setup` has a database to migrate against.

## Recommended order

```bash
# /opsx:apply add-local-docker-devops    ✓ done — archived 2026-08-08
/opsx:apply add-shadcn-ui-foundation      # 1. independent; gives the auth forms their components
/opsx:apply add-auth-route-protection     # 2. independent; creates lib/auth.ts and the auth routes
/opsx:apply add-drizzle-db-setup          # 3. container is already up
/opsx:apply add-credentials-auth-provider # 4. needs steps 2 and 3
```

Steps 1 and 2 can swap or run at any point before the last. `add-credentials-auth-provider` must be last.

### Why shadcn before the auth changes

`add-credentials-auth-provider` builds sign-in, sign-up, forgot-password and reset forms. Landing shadcn first means those forms are built once with real components rather than built plain and restyled later.

### Why route protection before credentials auth

`add-credentials-auth-provider` extends `lib/auth.ts`, the `/sign-in` and `/sign-up` routes, and the `proxy.ts` matcher — all created by `add-auth-route-protection`. Applying it first means those files exist to extend rather than having to be invented, which is duplicated work.

## Collision points

Two changes edit the same regions. Whichever applies second reconciles by hand.

**`app/layout.tsx` header** — `add-shadcn-ui-foundation` restyles the controls (task 5.2 replaces the hand-written purple Sign Up button with a shadcn `Button`); `add-auth-route-protection` changes what they do (task 5.1 converts modal triggers to links). Different intent, adjacent markup. Task 5.4 of the auth change flags this explicitly.

**`package.json` and `CLAUDE.md`** — every change touches both, in disjoint sections. Conflicts are trivial.

## Ordering constraints inside a change

Some task groups are ordered for correctness, not convenience. Applying them out of order produces a broken intermediate state.

**`add-auth-route-protection`** — `proxy.ts` changes come last (group 6). Flipping to default-deny before `/sign-in` exists makes the app unreachable: the redirect target 404s while every other route demands a session. Task 6.1 states this as a gate.

**`add-drizzle-db-setup`** — the Docker container must be running before group 1. Task 1.1 checks it.

**`add-credentials-auth-provider`** — group 1 verifies both prerequisite changes are implemented before anything else, and task 1.4 confirms Clerk still works, establishing the baseline the change must not break.

**`add-local-docker-devops`** (archived) — `docker-all-up.sh` had to use `docker compose up -d --wait`, or the script returns as soon as containers are created; Postgres restarts itself mid-initialisation, so a following `db:migrate` intermittently fails looking like a broken migration. Verification confirmed something worse than expected: `up --wait` returns **exit 0** for a service with no healthcheck, so the readiness guarantee is silently absent rather than merely weakened. Every service added under `DevOps/Local/` must define one.

## Config the apply phase needs

Values that cannot be committed and must be set in `.env.local` at apply time. `.gitignore` covers `.env*`.

```bash
# Already present — set during Clerk installation
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# add-auth-route-protection
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# plus the sign-in and sign-up FALLBACK redirect variables → /dashboard
# use the fallback variables, not the forced-redirect ones: a forced redirect
# overrides the remembered destination and silently breaks deep linking

# add-drizzle-db-setup — value comes from the compose file in step 1
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>

# add-credentials-auth-provider
AUTH_PROVIDER=clerk          # or `credentials`; defaults to clerk when unset
RESEND_API_KEY=...
```

`AUTH_PROVIDER` is deliberately **not** `NEXT_PUBLIC_` — that would inline it into the client bundle at build time and freeze the provider per build instead of per environment.

## Tracking progress

```bash
openspec list                              # task counts across all changes
openspec status --change "<name>"          # artifact status for one change
openspec instructions apply --change "<name>" --json    # apply guidance for a change
```

`tasks.md` checkboxes are what the apply phase parses. Only `- [ ] X.Y` lines are tracked.

## Archiving

Once a change is implemented and its tasks are checked off:

```bash
/opsx:archive <change-name>
```

Or directly:

```bash
openspec archive "<change-name>"
openspec archive "<change-name>" --yes            # skip confirmation
openspec archive "<change-name>" --skip-specs     # infrastructure/tooling/docs-only
```

Archiving folds the change's delta specs into `openspec/specs/` and moves the change to `openspec/changes/archive/`. `openspec list --specs` is empty until the first archive.

`add-local-docker-devops` looked like the one candidate for `--skip-specs`, being pure infrastructure — but it declared a real capability with observable behaviour, so it was archived normally and `local-dev-environment` is now the first entry in `openspec/specs/`. Full detail in `OpenSpec-Commands-Archive.md`.

## Verification each change requires

No test framework is installed, so every change ends with manual checks plus:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Three changes carry verification that goes well beyond this:

- **`add-credentials-auth-provider`** — groups 9, 10 and 11 are 30 hand-run security checks: timing equivalence between unknown-address and wrong-password responses, reset-token storage inspection, session revocation, rate limits, cross-provider ownership isolation. Nothing automated guards any of it afterwards.
- **`add-auth-route-protection`** — group 7 includes adding a throwaway unconfigured route to confirm default-deny actually holds, and a hand-crafted external redirect destination to confirm it is rejected.
- **`add-shadcn-ui-foundation`** — group 7 covers both colour schemes, no-flash-before-paint, hydration warnings, keyboard traversal, and dialog focus behaviour.

## Known risks carried into implementation

Recorded in each change's `design.md`. The four that most warrant attention while applying:

1. **Middleware does not protect Server Actions.** Every Server Action and route handler must call `requireUserId()` as its first statement. Manual browser testing will not catch this — pages redirect correctly while actions stay callable without a session.
2. **No test suite guards the credentials auth security properties.** Verified once by hand, then unguarded. A later refactor can silently remove enumeration resistance or session invalidation. A test framework should realistically precede exposing that path to real users.
3. **`shadcn init` rewrites `app/globals.css`.** The Geist font token mappings live in the block it replaces. Losing them degrades quietly — the app works, in the wrong typeface. Diff the file rather than trusting it.
4. **Adopting a managed Postgres host later can remove transactions.** Once auth flows rely on `db.transaction()`, switching to Neon's HTTP driver breaks them at runtime, in production, in flows verified locally. Any host adopted after step 5 must support interactive transactions.

## Start here

The Docker stack is up and `DATABASE_URL` is documented in `README.md`. Next:

```bash
/opsx:apply add-shadcn-ui-foundation
```

Or go straight for the data layer, which is now unblocked:

```bash
/opsx:apply add-drizzle-db-setup
```
