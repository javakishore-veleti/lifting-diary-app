## 1. Dependencies and local database

- [x] 1.1 Confirm `add-local-docker-devops` is implemented and the Postgres container is running — there is otherwise nothing to connect to or migrate against
- [x] 1.2 Install active runtime dependencies: `npm install drizzle-orm pg server-only` and `npm install -D @types/pg`
- [x] 1.3 Install `@neondatabase/serverless` — deliberately unused, so adopting a managed host later is a wiring change rather than a dependency change. Do not import it anywhere
- [x] 1.4 Install dev dependency: `npm install -D drizzle-kit`
- [x] 1.5 Set `DATABASE_URL` in `.env.local` to the local container's connection string, matching the credentials and port the compose file defines
- [x] 1.6 Confirm `.gitignore` already excludes `.env*` so the file cannot be committed
- [x] 1.7 Create `.env.example` listing `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` with placeholder values only — no real credentials, and no managed-host connection string

## 2. Environment validation

- [x] 2.1 Create `db/env.ts` that imports `server-only`, reads `process.env.DATABASE_URL`, and exports it as a non-optional typed string
- [x] 2.2 Throw a named error when the variable is absent, stating that it must be set for the app to run
- [x] 2.3 Throw a named error when the value does not parse as a URL with a `postgres:` or `postgresql:` protocol, so a malformed value fails before any connection attempt
- [x] 2.4 Verify no error path interpolates the connection string into its message — the value carries credentials and reaches logs
- [x] 2.5 Verify manually: with `DATABASE_URL` unset, the app fails at startup naming the variable; with a junk value, it fails as invalid

## 3. Database client

- [x] 3.1 Create `db/index.ts` that imports `server-only`, constructs a `node-postgres` pool from the validated URL, and exports a Drizzle instance wired to the schema
- [x] 3.1a Confirm `db.transaction()` is available and works — this is the capability `add-credentials-auth-provider` depends on, and verifying it here avoids discovering its absence during that change
- [x] 3.2 Confirm the module exports a single shared client rather than constructing a connection per call site
- [x] 3.3 Verify the server boundary holds: temporarily import `@/db` from a `"use client"` module, confirm the build fails with a `server-only` resolution error, then revert the import

## 4. Schema definition

- [x] 4.1 Create `db/schema.ts` with an `exercises` table: `uuid` primary key defaulting to `gen_random_uuid()`, `user_id text not null`, `name text not null`, `created_at` defaulting to database time
- [x] 4.2 Add a `workouts` table: `uuid` primary key, `user_id text not null`, session date column, `created_at` defaulting to database time
- [x] 4.3 Add a `sets` table: `uuid` primary key, `user_id text not null`, `workout_id` and `exercise_id` foreign keys, `reps integer not null`, `weight numeric(6,2) not null`, `position smallint not null`, `created_at` defaulting to database time
- [x] 4.4 Set foreign key actions: `sets.workout_id` cascades on delete; `sets.exercise_id` restricts on delete
- [x] 4.5 Add check constraints: `reps > 0`, `weight >= 0`, and `length(trim(name)) > 0` on exercise names
- [x] 4.6 Add a unique index on `(user_id, lower(name))` for `exercises` so names are unique per owner and case-insensitive
- [x] 4.7 Add a non-unique index on `user_id` for each of the three tables
- [x] 4.8 Settle the `numeric` TypeScript representation once — string or `{ mode: 'number' }` — and document the choice in a comment at the `weight` column
- [x] 4.9 Export inferred select and insert types for each table

## 5. Migration workflow

- [x] 5.1 Create `drizzle.config.ts` pointing at `db/schema.ts`, output directory `drizzle/`, dialect `postgresql`, and the validated connection string
- [x] 5.2 Add npm scripts `db:generate` and `db:migrate`; do not add a `db:push` script
- [x] 5.3 Run `npm run db:generate` and confirm SQL migration files appear in `drizzle/`
- [x] 5.4 Review the generated SQL by hand — confirm the check constraints, the case-insensitive unique index, and both foreign key actions are present
- [x] 5.5 Run `npm run db:migrate` against the local container and confirm the three tables exist
- [x] 5.6 Run `npm run db:migrate` a second time and confirm it is a no-op reporting success
- [x] 5.7 Confirm `drizzle/` is committed and not excluded by `.gitignore`

## 6. Constraint verification

- [x] 6.1 Verify rejection cases against the database: `reps` of 0, negative `weight`, empty or whitespace-only exercise name
- [x] 6.2 Verify a `weight` of 0 is accepted, and that 2.5 reads back as 2.5 with no rounding drift
- [x] 6.3 Verify two different `user_id` values can each hold an exercise named "Back Squat", while the same user cannot hold both "Back Squat" and "back squat"
- [x] 6.4 Verify a set referencing a non-existent workout or exercise is rejected
- [x] 6.5 Verify deleting a workout removes its sets, and deleting an exercise that has sets is rejected with both records left intact
- [x] 6.6 Verify a workout with no sets persists and is retrievable

## 7. Database-assigned creation timestamps

Added after verification found that `DEFAULT now()` alone does not satisfy the
`training-log` scenario "Caller supplies a creation timestamp" — an explicit
insert overrode it.

- [x] 7.0a Create a custom migration with `drizzle-kit generate --custom` rather than hand-editing `_journal.json`, so the journal and snapshot chain stay consistent
- [x] 7.0b Add a `BEFORE INSERT` trigger on all three tables forcing `created_at = now()`
- [x] 7.0c Cover `BEFORE UPDATE` too, preserving the original value — otherwise insert-then-update is a trivial bypass
- [x] 7.0d Verify a caller-supplied `created_at` is overridden, and that updating it does not change the stored value
- [x] 7.0e Verify normal inserts still populate `created_at`, `db:migrate` stays idempotent, and `db:generate` reports no drift
- [x] 7.0f Verify both migrations apply cleanly to a database rebuilt from scratch — the real test of a hand-written migration in a chain
- [x] 7.0g Document that drizzle-kit does not model triggers, so this migration is not reproducible by `db:generate`

## 8. Documentation and checks

- [x] 8.1 Add a database setup section to `README.md`: start the local container, set `DATABASE_URL`, run `npm run db:migrate`
- [x] 8.2 Note in `CLAUDE.md` that `db/` holds the schema and client, that migrations are generated and committed, and that `drizzle-kit push` is not used
- [x] 8.2a Note in `CLAUDE.md` that `@neondatabase/serverless` is installed but intentionally unused, so it is not deleted as dead weight nor mistaken for the active driver
- [x] 8.2b Verify the unreachable-database failure names the cause and points at starting the container: stop the container, start the app, and read the error
- [x] 8.3 Run `npx tsc --noEmit` and confirm it passes
- [x] 8.4 Run `npm run lint` and confirm it passes
- [x] 8.5 Run `npm run build` and confirm it succeeds with no database credentials present in the browser bundle output
