## 1. Prerequisites

- [x] 1.1 Confirm Docker and Docker Compose are installed and the engine is running
- [x] 1.2 Confirm port 5432 is free; if a native Postgres is installed via Homebrew it will hold it, and the conflict must be resolved or the published port changed
- [x] 1.3 Create the `DevOps/Local/` directory tree

## 2. Postgres service

- [x] 2.1 Create `DevOps/Local/Postgres/docker-compose.yaml` defining a single Postgres service
- [x] 2.2 Pin the image to a major tag such as `postgres:17`, never `latest` — a silent major change breaks against an existing data directory with an error that does not say so
- [x] 2.3 Confirm the chosen version is 13 or newer, which `add-drizzle-db-setup` requires for `gen_random_uuid()`
- [x] 2.4 Set fixed development credentials and database name, with a comment stating they are local-only and must never be reused for a deployed host
- [x] 2.5 Publish the port bound to localhost explicitly rather than all interfaces, so the database is not exposed to the local network
- [x] 2.6 Define a named volume for the data directory rather than a host bind mount
- [x] 2.7 Add a healthcheck using `pg_isready` with both the user and database named — omitting them can pass while the target database does not yet exist during initialisation
- [x] 2.8 Set a restart policy appropriate for local development

## 3. Lifecycle scripts

- [x] 3.1 Create `DevOps/Local/docker-all-up.sh` with an explicit interpreter line and strict error handling
- [x] 3.2 Discover services by globbing `DevOps/Local/*/docker-compose.yaml` rather than naming Postgres — this is what keeps future services from needing a script edit
- [x] 3.3 Use `docker compose up -d --wait` so the command does not return until healthchecks pass; without this, a following `db:migrate` intermittently fails because Postgres restarts itself mid-initialisation
- [x] 3.4 Check that the container engine is running before anything else and fail with a message naming that as the cause — this is the most common failure and the raw compose error buries it
- [x] 3.5 Report per-service failures naming the service and how to view its logs, and continue rather than aborting the whole stack on one bad definition
- [x] 3.6 Exit non-zero if any service fails to become healthy
- [x] 3.7 Create `DevOps/Local/docker-all-down.sh` running `docker compose down` **without** `-v`
- [x] 3.8 Add an explicit `--destroy-data` flag that adds `-v`, and print what is about to be destroyed before doing it
- [x] 3.9 Confirm the no-argument path removes no volume — `down -v` is one character from the safe form and is muscle memory
- [x] 3.10 Create `DevOps/Local/all-status.sh` reporting three distinct states per service: not running, running but not healthy, running and healthy
- [x] 3.11 Include the published port for each running service
- [x] 3.12 Exit zero when nothing is running — status is a question, not an assertion, and a non-zero exit makes it unusable in a conditional
- [x] 3.13 Make all three scripts executable with `chmod +x`
- [x] 3.14 Confirm each script works when invoked from the repository root as well as from `DevOps/Local/`

## 4. Verify the stack

- [x] 4.1 With nothing running, run `all-status.sh` and confirm every service reports not running and the command exits zero
- [x] 4.2 Run `docker-all-up.sh` from a clean state and confirm it does not return until Postgres is healthy
- [x] 4.3 Immediately after up returns, connect with a client on the documented connection string and confirm it succeeds on the first attempt
- [x] 4.4 Run `all-status.sh` and confirm Postgres reports running and healthy with its port
- [x] 4.5 Run `docker-all-up.sh` again while the stack is up and confirm it succeeds without restarting healthy services
- [x] 4.6 Write a row to a scratch table, run `docker-all-down.sh`, run up again, and confirm the row is still present
- [x] 4.7 Run `docker-all-down.sh` with nothing running and confirm it succeeds
- [x] 4.8 Stop the Docker engine, run `docker-all-up.sh`, and confirm the failure names the engine rather than a service
- [x] 4.9 Run `docker-all-down.sh --destroy-data` and confirm the volume is removed and the destruction is stated
- [x] 4.10 Bring the stack up again and confirm a fresh, empty database initialises correctly

## 5. Verify extensibility

- [x] 5.1 Add a throwaway second service directory with a valid compose file and healthcheck
- [x] 5.2 Confirm up, down, and status all include it with no edit to any script
- [x] 5.3 Confirm the Postgres definition was not modified
- [x] 5.4 Remove the throwaway service and confirm the scripts return to reporting one service

## 6. Documentation

- [x] 6.1 Add a local development section to `README.md`: required tooling, the three commands, and how to confirm the stack is healthy
- [x] 6.2 Document the exact `DATABASE_URL` connection string for the local database, so `add-drizzle-db-setup` has a value to use
- [x] 6.3 Document that `--destroy-data` destroys the database and that ordinary shutdown does not
- [x] 6.4 Document the port 5432 conflict with a natively installed Postgres and how to identify what holds the port
- [x] 6.5 Document that changing the Postgres major version requires destroying the volume
- [x] 6.6 Record in `CLAUDE.md` that `DevOps/Local/` holds the local stack, one directory per service
- [x] 6.7 Record in `CLAUDE.md` that **every service added here must define a healthcheck** — `--wait` has nothing to wait on otherwise, and the readiness guarantee is silently lost for the whole stack
- [x] 6.8 Add any local data directory to `.gitignore` if a bind mount was used instead of a named volume
