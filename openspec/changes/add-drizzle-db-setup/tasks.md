## 1. Dependencies and local database

- [ ] 1.1 Confirm `add-local-docker-devops` is implemented and the Postgres container is running — there is otherwise nothing to connect to or migrate against
- [ ] 1.2 Install active runtime dependencies: `npm install drizzle-orm pg server-only` and `npm install -D @types/pg`
- [ ] 1.3 Install `@neondatabase/serverless` — deliberately unused, so adopting a managed host later is a wiring change rather than a dependency change. Do not import it anywhere
- [ ] 1.4 Install dev dependency: `npm install -D drizzle-kit`
- [ ] 1.5 Set `DATABASE_URL` in `.env.local` to the local container's connection string, matching the credentials and port the compose file defines
- [ ] 1.6 Confirm `.gitignore` already excludes `.env*` so the file cannot be committed
- [ ] 1.7 Create `.env.example` listing `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` with placeholder values only — no real credentials, and no managed-host connection string

## 2. Environment validation

- [ ] 2.1 Create `db/env.ts` that imports `server-only`, reads `process.env.DATABASE_URL`, and exports it as a non-optional typed string
- [ ] 2.2 Throw a named error when the variable is absent, stating that it must be set for the app to run
- [ ] 2.3 Throw a named error when the value does not parse as a URL with a `postgres:` or `postgresql:` protocol, so a malformed value fails before any connection attempt
- [ ] 2.4 Verify no error path interpolates the connection string into its message — the value carries credentials and reaches logs
- [ ] 2.5 Verify manually: with `DATABASE_URL` unset, the app fails at startup naming the variable; with a junk value, it fails as invalid

## 3. Database client

- [ ] 3.1 Create `db/index.ts` that imports `server-only`, constructs a `node-postgres` pool from the validated URL, and exports a Drizzle instance wired to the schema
- [ ] 3.1a Confirm `db.transaction()` is available and works — this is the capability `add-credentials-auth-provider` depends on, and verifying it here avoids discovering its absence during that change
- [ ] 3.2 Confirm the module exports a single shared client rather than constructing a connection per call site
- [ ] 3.3 Verify the server boundary holds: temporarily import `@/db` from a `"use client"` module, confirm the build fails with a `server-only` resolution error, then revert the import

## 4. Schema definition

- [ ] 4.1 Create `db/schema.ts` with an `exercises` table: `uuid` primary key defaulting to `gen_random_uuid()`, `user_id text not null`, `name text not null`, `created_at` defaulting to database time
- [ ] 4.2 Add a `workouts` table: `uuid` primary key, `user_id text not null`, session date column, `created_at` defaulting to database time
- [ ] 4.3 Add a `sets` table: `uuid` primary key, `user_id text not null`, `workout_id` and `exercise_id` foreign keys, `reps integer not null`, `weight numeric(6,2) not null`, `position smallint not null`, `created_at` defaulting to database time
- [ ] 4.4 Set foreign key actions: `sets.workout_id` cascades on delete; `sets.exercise_id` restricts on delete
- [ ] 4.5 Add check constraints: `reps > 0`, `weight >= 0`, and `length(trim(name)) > 0` on exercise names
- [ ] 4.6 Add a unique index on `(user_id, lower(name))` for `exercises` so names are unique per owner and case-insensitive
- [ ] 4.7 Add a non-unique index on `user_id` for each of the three tables
- [ ] 4.8 Settle the `numeric` TypeScript representation once — string or `{ mode: 'number' }` — and document the choice in a comment at the `weight` column
- [ ] 4.9 Export inferred select and insert types for each table

## 5. Migration workflow

- [ ] 5.1 Create `drizzle.config.ts` pointing at `db/schema.ts`, output directory `drizzle/`, dialect `postgresql`, and the validated connection string
- [ ] 5.2 Add npm scripts `db:generate` and `db:migrate`; do not add a `db:push` script
- [ ] 5.3 Run `npm run db:generate` and confirm SQL migration files appear in `drizzle/`
- [ ] 5.4 Review the generated SQL by hand — confirm the check constraints, the case-insensitive unique index, and both foreign key actions are present
- [ ] 5.5 Run `npm run db:migrate` against the local container and confirm the three tables exist
- [ ] 5.6 Run `npm run db:migrate` a second time and confirm it is a no-op reporting success
- [ ] 5.7 Confirm `drizzle/` is committed and not excluded by `.gitignore`

## 6. Constraint verification

- [ ] 6.1 Verify rejection cases against the database: `reps` of 0, negative `weight`, empty or whitespace-only exercise name
- [ ] 6.2 Verify a `weight` of 0 is accepted, and that 2.5 reads back as 2.5 with no rounding drift
- [ ] 6.3 Verify two different `user_id` values can each hold an exercise named "Back Squat", while the same user cannot hold both "Back Squat" and "back squat"
- [ ] 6.4 Verify a set referencing a non-existent workout or exercise is rejected
- [ ] 6.5 Verify deleting a workout removes its sets, and deleting an exercise that has sets is rejected with both records left intact
- [ ] 6.6 Verify a workout with no sets persists and is retrievable

## 7. Documentation and checks

- [ ] 7.1 Add a database setup section to `README.md`: start the local container, set `DATABASE_URL`, run `npm run db:migrate`
- [ ] 7.2 Note in `CLAUDE.md` that `db/` holds the schema and client, that migrations are generated and committed, and that `drizzle-kit push` is not used
- [ ] 7.2a Note in `CLAUDE.md` that `@neondatabase/serverless` is installed but intentionally unused, so it is not deleted as dead weight nor mistaken for the active driver
- [ ] 7.2b Verify the unreachable-database failure names the cause and points at starting the container: stop the container, start the app, and read the error
- [ ] 7.3 Run `npx tsc --noEmit` and confirm it passes
- [ ] 7.4 Run `npm run lint` and confirm it passes
- [ ] 7.5 Run `npm run build` and confirm it succeeds with no database credentials present in the browser bundle output
