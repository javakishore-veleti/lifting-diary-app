## Context

See `proposal.md` — Why. Design-relevant constraints only:

- Next.js 16.3.0 App Router, React 19, TypeScript strict, `@/*` aliased to the repo root. Server Components are the default execution context, so most database access is server-side by construction.
- Clerk is already installed and is the sole identity provider. `auth()` from `@clerk/nextjs/server` yields a `userId` string. There is no local user table and none is introduced here.
- The project has no test framework and no test script. Nothing in this design may assume one exists; verification is manual and via `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- No persistence exists yet, so there is no legacy schema, no data to migrate, and no backward-compatibility burden. This is a greenfield schema.

This design covers a new external dependency, the initial data model, and a migration workflow, each of which qualifies under the "when to include design.md" criteria.

## Goals / Non-Goals

**Goals:**

- One shared, lazily-initialised database client that server code imports, with credentials unreachable from browser bundles.
- Configuration errors that fail loudly at startup with an actionable message, never as an opaque connection error at first query.
- Schema evolution through committed SQL migrations that are reviewable in a pull request.
- Data-integrity rules from `specs/training-log/spec.md` enforced by database constraints, not only by application code.

**Non-Goals:**

- Query helpers, repositories, or data-access functions. The schema and client are the deliverable; callers come in a later change.
- Row-level security or database-enforced tenancy. Ownership is enforced by `WHERE` clauses in application queries; see Risks.
- Connection pooling strategy, read replicas, or performance tuning.
- Seed data or fixtures.
- Reacting to Clerk user deletion. Orphaned training rows are accepted for now and called out in the proposal's Impact.

## Decisions

### `node-postgres` against local Postgres, with the Neon driver installed but dormant

Use `drizzle-orm/node-postgres` with `pg` against a Postgres container on localhost. Also install `@neondatabase/serverless`, import it nowhere, and leave it unused.

Long-lived TCP connections are the right shape here: `next dev` is a single long-running process against a database on the same machine, so a connection pool is an asset rather than the liability it becomes in serverless. Queries avoid a network round trip entirely.

*The decisive advantage is transactions.* `node-postgres` supports interactive transactions, so `db.transaction()` works. Neon's HTTP driver does not, and that gap is not academic — `add-credentials-auth-provider` needs multi-statement atomicity for registration and password-reset flows, and would have been forced into single-statement workarounds or a driver change.

*Why install a driver we do not use.* Adopting a managed host later should be a wiring change in `db/index.ts` plus an environment variable, not a dependency negotiation at the moment of deployment. The package is small and unreferenced code is tree-shaken out of the build. The cost is one dependency that a reader may reasonably wonder about, which is why it is documented here and in `CLAUDE.md`.

*Alternatives considered.* Neon's HTTP driver as the active one was the earlier plan and was reversed: it buys serverless-shaped connection handling for an application that is not deployed anywhere, at the price of the transactions the auth work needs. Selecting the driver by environment — local `pg`, deployed `neon-http` — was considered and rejected as the worst of both: the two drivers have *different transaction capability*, so a transaction written and verified locally would compile, pass review, and fail only in production. A capability gap that runs in that direction is close to undetectable before deploy.

*Consequence.* There is no deployment story. This is deliberate deferral, recorded in Risks and as an open question, not an oversight.

### Hand-rolled environment validation, no schema-validation library

A small module reads `process.env.DATABASE_URL`, asserts it is present and parses as a URL with a `postgres:`/`postgresql:` protocol, and throws a named error otherwise. It exports the validated value as a typed non-optional string.

One variable does not justify adding a validation dependency. If the project later validates a broader environment surface, replacing this module with Zod or `@t3-oss/env-nextjs` is a contained change.

The module must not interpolate the connection string into its error messages — the string embeds credentials, and error output reaches logs.

### `server-only` to enforce the server boundary

`specs/data-persistence/spec.md` requires that a client-side import of the database module fail the build. The `server-only` package provides exactly this via a build-time resolution error, and is the idiomatic Next.js mechanism. Both the client module and the env module import it.

Relying on convention or the absence of `"use client"` was rejected: it makes the requirement unverifiable and regressions silent.

### UUID primary keys generated by the database

Every table uses `uuid` primary keys defaulting to `gen_random_uuid()` (built into Postgres 13+, so no extension is needed provided the container image is 13 or newer).

Sequential integer keys would leak row counts and allow enumeration through any future URL that carries an ID. Generating IDs in the database rather than the application keeps ID assignment authoritative in one place.

### Clerk user IDs stored as opaque indexed text

`user_id text not null`, with a non-unique index on every owned table. Clerk IDs are opaque strings (`user_...`) with no documented length bound, so no length constraint is imposed. There is no foreign key, because there is no local users table — Clerk owns identity.

### Weight as `numeric(6,2)`

`specs/training-log/spec.md` requires that a stored 2.5 read back exactly. `real`/`double precision` are binary floats and cannot represent common plate weights exactly, so they were rejected. `numeric(6,2)` holds up to 9999.99 in either kilograms or pounds, well past any human load.

*Trade-off.* Drizzle maps `numeric` to `string` in TypeScript by default to avoid precision loss through JavaScript's number type. Callers must convert at the edge. Drizzle's `{ mode: 'number' }` option can return numbers instead, at the cost of reintroducing float conversion; implementation should confirm which behaviour the installed version provides and apply it consistently rather than converting ad hoc at call sites.

*Alternative considered.* Storing integer hundredths sidesteps the string mapping but forces every read and write through a conversion and makes raw SQL inspection unpleasant. Rejected as the worse ergonomic trade.

### Integrity enforced by database constraints

The spec's validation rules become `CHECK` constraints rather than application-layer guards, so they hold regardless of which code path writes:

- `reps` — `integer not null check (reps > 0)`
- `weight` — `numeric(6,2) not null check (weight >= 0)`
- exercise `name` — `check (length(trim(name)) > 0)`

Drizzle expresses these through the table builder's third-argument `check()` helper, so they live in the schema definition and flow into generated migrations.

### Per-user, case-insensitive exercise name uniqueness

A unique index on `(user_id, lower(name))`. Scoping to `user_id` satisfies the requirement that two users may both own "Back Squat". Case-insensitivity is an assumption beyond what the spec states: a lifter typing "back squat" almost certainly means their existing "Back Squat", and silently creating a near-duplicate would fragment their history. Recorded here as a deliberate reading rather than a spec change.

### Deletion semantics differ by relationship

- `sets.workout_id` → `on delete cascade`. A workout's sets have no meaning without it, matching the spec scenario where deleting a workout removes its sets.
- `sets.exercise_id` → `on delete restrict`. Deleting an exercise that has recorded sets would destroy training history, so the spec requires rejection.

### Explicit `position` column for set ordering

Sets carry `position smallint not null`, assigned by the caller. Ordering by `created_at` was rejected: rows inserted in one statement can share a timestamp, leaving order undefined, and it would prevent reordering a mis-entered set later.

### Generated migrations, never `drizzle-kit push`

`drizzle-kit generate` emits SQL into `drizzle/` which is committed; `drizzle-kit migrate` applies it. `push` diffs the schema straight onto the database with no artifact, which makes changes invisible in review and unrepeatable across environments.

Migrations run as an explicit `npm run db:migrate`, never automatically at application boot — boot-time migration invites concurrent processes racing the same migration, and it couples starting the app to having write access to the schema.

### File layout

```
db/
  index.ts       # drizzle client; imports server-only
  env.ts         # DATABASE_URL validation; imports server-only
  schema.ts      # exercises, workouts, sets
drizzle/         # generated SQL migrations (committed)
drizzle.config.ts
```

`db/` sits at the repo root beside `app/`, reachable as `@/db/...`. Placing it under `app/` was rejected — App Router treats that tree as routable, and non-route modules there add noise.

## Risks / Trade-offs

**No deployment target** → A local container is unreachable from any hosted environment, so the app runs on a developer machine and nowhere else. Mitigation: none needed yet, but the managed-host decision is deferred rather than solved, and the Neon driver is pre-installed so making it is small. The driver swap touches only `db/index.ts`; the schema and every query are unaffected.

**Docker becomes a hard prerequisite** → `npm run dev` alone no longer suffices; the container must be running first, and a stopped container presents as a connection error rather than an obvious "start the database" message. Mitigation: the spec requires the unreachable-database failure to name the cause and point at the fix, and `add-local-docker-devops` supplies a single command to bring it up.

**Data lives in a Docker volume** → `docker compose down -v` destroys the database, and the flag is easy to add reflexively. Mitigation: `add-local-docker-devops` owns the volume naming and the down-script's behaviour, and its scripts should not remove volumes by default.

**Nothing exercises production-like conditions** → SSL negotiation, network latency, and connection limits go untested until a managed host is adopted, at which point all of them arrive together. Mitigation: accepted consequence of deferring deployment; the Neon activation change is where they get addressed.

**Ownership enforced only in application queries** → Every read must carry `where eq(table.userId, userId)`. A forgotten predicate leaks another user's data, and no database mechanism catches it. Mitigation: the follow-up query-layer change should centralise access behind functions that take `userId` as a required parameter, so no call site constructs a raw unfiltered query. Postgres RLS is the stronger control and `node-postgres` could carry the per-request session variables it needs, so this becomes worth revisiting once the query layer exists — it was ruled out under the previous HTTP-driver plan and is no longer foreclosed.

**`numeric` surfacing as `string` in TypeScript** → Silent bugs if a caller does arithmetic on it and gets concatenation. Mitigation: settle the representation once in `db/schema.ts` and document it in a comment at the column definition.

**Unreferenced Neon dependency invites confusion** → A reader finds `@neondatabase/serverless` in `package.json` with no import anywhere and may either delete it as dead weight or assume Neon is in use. Mitigation: documented in this decision and recorded in `CLAUDE.md`, so the intent survives beyond this change.

**Credentials in `.env.local`** → Already covered by the `.env*` entry in `.gitignore`. `.env.example` must carry placeholders only.

**Schema drift between definition and committed migrations** → A developer edits `schema.ts`, forgets `db:generate`, and the schema works locally against a `push`-style database but not on a fresh migrate. Mitigation: `push` is not used at all, so the only path to a working database is through generated migrations.

## Migration Plan

No data migration — there is no existing database.

Ordering is a hard constraint: `add-local-docker-devops` must land first, since there is otherwise no database to migrate against.

Rollout: bring the local Postgres container up, set `DATABASE_URL` to point at it in `.env.local`, run `npm run db:generate` then `npm run db:migrate`, confirm the three tables exist.

Rollback: the change is additive and no application code reads these tables yet, so reverting the commit is sufficient. Dropping the tables is optional cleanup, not a correctness requirement — and with a local container, discarding the volume achieves the same thing.

## Open Questions

- **When to adopt a managed Postgres host.** Deferred deliberately. The Neon driver is already installed, so activation is a wiring change in `db/index.ts` plus a connection string, and it becomes worth doing at the point deployment is real and can actually be tested. Note that switching to Neon's HTTP driver would *remove* interactive transactions, so a host adopted after `add-credentials-auth-provider` lands must either use Neon's WebSocket driver or another Postgres provider — this is the one decision here that gets harder with time rather than easier.
- **Weight units.** The schema stores a bare number with no unit column. Whether the app is kilograms-only, pounds-only, or per-user configurable is a product decision that affects UI and any future analytics, but not this schema — a `unit` column or user preference can be added later without altering existing columns. Deferred deliberately.
- **Exercise catalog seeding.** Whether users start with a standard set of common lifts or an empty catalog. Affects onboarding UX only; the schema supports both.
