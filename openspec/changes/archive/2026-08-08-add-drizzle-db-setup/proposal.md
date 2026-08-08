## Why

The app has authentication (Clerk) but no persistence layer, so a signed-in lifter has nowhere to record a workout. Every feature the product exists to deliver — logging sets, reviewing history, tracking progress on a lift — depends on durable, per-user storage, which makes the database the blocking prerequisite for all of it.

## What Changes

- Add Drizzle ORM against a **local Postgres instance** using the `node-postgres` driver, plus a single shared database client that server-side code imports rather than constructing connections ad hoc.
- Install the Neon serverless driver alongside it but leave it unused, so adopting a managed host later is a configuration and wiring change rather than a dependency change. Activating Neon is deliberately deferred to its own change.
- Add fail-fast validation of database environment variables at startup, so a missing or malformed `DATABASE_URL` surfaces as a clear error instead of a connection failure at first query.
- Add a versioned migration workflow using drizzle-kit: SQL migration files are generated from the schema, committed to the repo, and applied by an explicit command. Schema drift is detectable rather than silent.
- Add the starter lifting-diary schema — exercises, workouts, and sets — with every user-owned row keyed to the Clerk `userId` so records are scoped to their owner.
- Add npm scripts for generating and applying migrations, and document the local setup path (start the local database, set the connection string, migrate).
- No changes to authentication, routing, or any existing UI. No user-facing surface ships in this change.

## Capabilities

### New Capabilities

- `data-persistence`: How the application connects to its database, validates database configuration, and evolves the schema over time through versioned migrations.
- `training-log`: The domain model for recording resistance training — the exercise catalog, workout sessions, and the individual sets performed within them, including ownership and data-integrity rules.

### Modified Capabilities

None. No existing spec-level behavior changes; this is the first persistence capability in the project.

## Impact

**Depends on the local Docker Postgres change.** The container that serves this database is provisioned by `add-local-docker-devops`, which must land first — without it there is no database to connect to or migrate against.

**Dependencies added:** `drizzle-orm` and `pg` with `@types/pg` (runtime, active); `@neondatabase/serverless` (runtime, installed but unused, present so a future managed-host switch touches no dependency); `drizzle-kit` (dev).

**New code:** database client module, environment validation module, Drizzle schema definitions, `drizzle.config.ts`, and a generated migrations directory.

**Modified files:** `package.json` (dependencies and migration scripts), `.env.local` (adds `DATABASE_URL`), `.env.example` (new, documenting required variables), `README.md` (setup instructions).

**External services:** none. The database runs locally in Docker, so no vendor account or network dependency is introduced and no database credentials leave the machine. The cost is that Docker becomes a hard prerequisite for running the app at all.

**No deployment target.** A local container is unreachable from any hosted environment, so this change makes the app runnable on a developer machine and nowhere else. Choosing and wiring a managed Postgres host remains outstanding work, deferred rather than eliminated.

**Existing systems:** Clerk remains the sole identity provider. The schema stores Clerk user IDs as opaque strings and does not mirror user profiles, so no synchronization between Clerk and the database is introduced. Deleting a Clerk user does not cascade to their training data — that is out of scope here and left for a future change.

**Capability worth noting:** `node-postgres` supports interactive transactions, so `db.transaction()` is available. This matters beyond this change — `add-credentials-auth-provider` needs multi-statement atomicity for its authentication flows, and the driver chosen here provides it.
