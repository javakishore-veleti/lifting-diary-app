## Why

`add-drizzle-db-setup` targets a local Postgres instance, but nothing in the repository provides one. Without it that change cannot be implemented at all: there is no database to connect to, no schema to migrate, and no way for a developer to run the application.

Beyond Postgres, local development will accumulate other backing services over time — a mail catcher, a cache, an object store. Provisioning each one ad hoc leaves every developer with a slightly different environment and no single answer to "is my stack up?". Establishing the container layout and its lifecycle commands once, with the first service, is considerably cheaper than retrofitting a convention around three services later.

## What Changes

- Add a `DevOps/Local/` tree holding the local development stack, with each service in its own subdirectory so services are added without touching existing ones.
- Add `DevOps/Local/Postgres/docker-compose.yaml` defining a Postgres service with a fixed version, a named persistent volume, a published port, and a healthcheck that reports when the database is genuinely ready to accept queries rather than merely started.
- Add three lifecycle scripts at `DevOps/Local/`: `docker-all-up.sh` to bring every service up, `docker-all-down.sh` to stop them, and `all-status.sh` to report what is running and healthy. Each discovers services rather than hard-coding Postgres, so adding a service requires no script change.
- Make `docker-all-down.sh` preserve data by default, requiring an explicit opt-in to destroy volumes, so a routine shutdown cannot discard the training database.
- Document the local stack in `README.md`, including the connection string `DATABASE_URL` should use.

## Capabilities

### New Capabilities

- `local-dev-environment`: How a developer brings the application's backing services up, verifies they are ready, and shuts them down; the guarantee that data survives a normal stop and restart; and the requirement that adding a service does not require editing the lifecycle commands.

### Modified Capabilities

None. `data-persistence` (proposed in `add-drizzle-db-setup`) already requires that the setup be reproducible from documentation and that an unreachable database fail with a message pointing at the fix — this change supplies the database those requirements assume, without altering them.

## Impact

**Blocks `add-drizzle-db-setup`.** This change must land first. It is now the root of the dependency chain: `add-local-docker-devops` → `add-drizzle-db-setup` → `add-credentials-auth-provider`. `add-shadcn-ui-foundation` and `add-auth-route-protection` remain independent of all three.

**Dependencies added:** none in `package.json`. Docker and Docker Compose become required tooling on the developer machine — a prerequisite rather than a dependency, and one that is not installable by `npm install`.

**New files:** `DevOps/Local/Postgres/docker-compose.yaml`, `DevOps/Local/docker-all-up.sh`, `DevOps/Local/docker-all-down.sh`, `DevOps/Local/all-status.sh`.

**Modified files:** `README.md` (prerequisites and stack commands), `CLAUDE.md` (where the local stack lives and how to start it), `.gitignore` (any local data directory, if one is used instead of a named volume).

**No application code changes.** Nothing under `app/`, `db/`, or `lib/` is touched. This change is purely local infrastructure.

**Credentials:** the compose file contains development-only Postgres credentials in plaintext, which is appropriate for a container bound to localhost and committed deliberately so the stack is reproducible. It must be obvious in the file that these are local-only, so they are never reused for a real host.

**Constraint worth flagging:** a container reporting "started" is not the same as Postgres being ready to accept connections — Postgres restarts itself during first-time initialisation. Without a healthcheck, `docker-all-up.sh` returns success and an immediately following `db:migrate` fails with a connection error, which reads as a broken migration rather than a race.
