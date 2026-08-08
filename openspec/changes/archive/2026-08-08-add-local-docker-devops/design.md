## Context

See `proposal.md` — Why. Design-relevant constraints only:

- **Nothing exists yet.** No `DevOps/` directory, no compose file, no scripts. This is greenfield and sets the convention for every service added later.
- **`add-drizzle-db-setup` consumes this.** It needs Postgres 13 or newer for `gen_random_uuid()`, `numeric(6,2)`, and `CHECK` constraints, and it needs `node-postgres` to reach the database over TCP on a published port.
- **macOS on Apple Silicon** is the development platform in use, so images must have arm64 builds. The official Postgres image does.
- **Shell scripts run under zsh or bash.** The user's login shell is zsh; scripts should not assume either interactively and should declare their own interpreter.
- **No CI.** These scripts are run by hand, so their output is read by a person, not parsed by a pipeline.

This change introduces a new architectural convention (the `DevOps/Local/` layout) and a service-discovery mechanism in the scripts, so it warrants a design document despite involving no application code.

## Goals / Non-Goals

**Goals:**

- One command that leaves the developer with a database genuinely ready for `db:migrate`, not merely a started container.
- A layout where adding the second and third service costs nothing in the lifecycle scripts.
- Data that survives ordinary use, and is destroyed only when explicitly asked for.
- Failure messages that name the cause, since these scripts fail most often for boring environmental reasons.

**Non-Goals:**

- Production or staging orchestration. This tree is local-only and its credentials say so.
- Kubernetes, Helm, or any deployment manifest.
- Seeding the database. `add-drizzle-db-setup` owns migrations; seed data is neither change's concern yet.
- Managing the Next.js app itself as a container. The app runs on the host via `npm run dev`; only backing services are containerised.
- Cross-platform Windows support. macOS and Linux shells only.

## Decisions

### One compose file per service, in its own directory

`DevOps/Local/Postgres/docker-compose.yaml`, with future services as siblings — `DevOps/Local/Mailpit/docker-compose.yaml` and so on.

A single combined compose file at `DevOps/Local/` would be simpler today with one service, and worse at three: every service change edits one shared file, unrelated services collide in diffs, and a service cannot be brought up alone. Per-service files keep each definition self-contained, which the spec requires.

*Consequence.* Services do not share a compose project by default, so they cannot reference each other by service name without extra work. That is acceptable — backing services in local development talk to the host, not to each other. If two ever need to, a shared external network is the addition, and it does not disturb this layout.

### Scripts discover services by globbing, never by naming them

Each script iterates `DevOps/Local/*/docker-compose.yaml` and runs the corresponding compose command for each match.

This is what makes the spec's "adding a service requires no script edit" requirement true rather than aspirational. Hard-coding `Postgres` would work now and quietly rot: the second service gets added, the scripts keep reporting a healthy stack, and the missing service is discovered only when something fails to connect.

*Consequence.* A directory containing a malformed or placeholder compose file is picked up automatically. The scripts should report per-service failures and continue rather than aborting the whole stack on one bad definition.

### `--wait` on up, rather than a hand-written poll loop

`docker compose up -d --wait` blocks until healthchecks pass and exits non-zero if any service fails to become healthy.

This is the central correctness decision. Without it the command returns as soon as containers are *created*, and the spec's requirement that a following command connect on its first attempt is violated — Postgres restarts itself partway through first-time initialisation, so a connection attempted immediately after start hits a database that is up, then briefly gone. The symptom is a `db:migrate` failure that looks like a broken migration, and it is intermittent, which makes it worse.

*Alternative considered.* A `pg_isready` poll loop in the script. Rejected: it duplicates what the healthcheck already declares, only for Postgres, and would need rewriting for each new service type. `--wait` derives its behaviour from whatever healthcheck each service defines, so it generalises for free.

*Requirement this imposes.* `--wait` is meaningless without a healthcheck, so every service added to this tree must define one. Worth recording in `CLAUDE.md`, because a service added without one silently loses the readiness guarantee for the whole stack.

### `pg_isready` as the Postgres healthcheck, with the user and database named

`pg_isready -U <user> -d <database>`. Omitting the flags checks only that the server responds, which can pass while the specific database is not yet created during initialisation — precisely the window this healthcheck exists to close.

### A named volume, not a bind mount

`postgres_data` as a named volume rather than a host directory.

Named volumes avoid the file-ownership and performance problems bind mounts have on macOS, and they keep database files out of the repository tree where a stray `git add` or an editor's file watcher could reach them. The trade-off is that the data is less directly inspectable, which is the right trade for database files nobody should be editing by hand.

### `down` stops without removing volumes; destruction is a separate explicit flag

`docker-all-down.sh` runs `docker compose down` with no `-v`. It accepts an explicit flag — `--destroy-data` — which adds `-v` and prints what it is about to do.

`docker compose down -v` is a single character away from the safe form and is muscle memory for many people. Making the destructive path opt-in and verbose means the training database is not lost to a reflexive shutdown, which the spec requires.

*Alternative considered.* Prompting for confirmation. Rejected: the scripts should stay usable non-interactively, and a long flag name is already deliberate enough.

### `all-status.sh` distinguishes three states, not two

For each service it reports not-running, running-but-not-healthy, or running-and-healthy, plus the published port when running.

The middle state is the one worth the effort. "Not ready yet" and "broken" produce identical symptoms for anyone connecting, and without a status command that separates them, the natural response to a connection failure is to restart the stack — which resets the initialisation it was in the middle of.

The script exits zero for a stopped stack. Status is a question, not an assertion, and a non-zero exit for "nothing is running" would make it useless in any conditional.

### Version pinned to a major tag

`postgres:17` rather than `postgres:latest`. `latest` means a colleague or a future rebuild silently gets a different major version, and Postgres major upgrades are not transparent to an existing data directory — the container fails to start against a volume initialised by an older version, with an error that does not obviously say so.

A major tag rather than a full patch pin keeps security patches arriving without pinning churn.

### Credentials committed in plaintext, and labelled

The compose file carries fixed development credentials in plaintext, with a comment stating they are local-only.

The alternative — a `.env` file for the compose stack — makes the stack non-reproducible from a clone and adds a setup step whose only benefit is hiding a password on a port bound to localhost. Committing them deliberately is the honest choice; the risk to manage is someone reusing them for a real host, which the comment and the README address.

*Requirement this imposes.* The published port binds to localhost explicitly rather than all interfaces, so the database is not exposed to the local network.

### File layout

```
DevOps/
  Local/
    docker-all-up.sh
    docker-all-down.sh
    all-status.sh
    Postgres/
      docker-compose.yaml
```

`DevOps/` at the repo root, capitalised as the user specified. It sits outside `app/`, `db/`, and `lib/`, and contains no TypeScript, so it is untouched by `tsc`, ESLint, and the Next.js build.

## Risks / Trade-offs

**A service added without a healthcheck silently breaks the readiness guarantee** → `--wait` has nothing to wait on, so up returns early for that service and the intermittent connection failures return. Mitigation: recorded in `CLAUDE.md` as a requirement for this tree; `all-status.sh` reporting a service as running-but-never-healthy is the visible symptom.

**Docker not running is the most common failure by far** → The raw compose error is verbose and buries the cause. Mitigation: each script checks engine availability first and fails with a message naming it.

**Postgres major version change against an existing volume** → The container refuses to start with an error that does not clearly say "wrong data directory version". Mitigation: pin the major tag; document that changing it requires destroying the volume, which is exactly what `--destroy-data` is for.

**Port 5432 already in use** → Common if Postgres is installed natively via Homebrew, and the failure names a port conflict without saying what holds it. Mitigation: document the conflict and how to identify the holder; the port is a single value in the compose file if it must move.

**Committed credentials get reused somewhere real** → Mitigation: labelled in the compose file, and the binding is localhost-only so they are not remotely usable as written.

**Glob-based discovery picks up unintended directories** → A scratch or half-finished service directory joins the stack. Mitigation: per-service failures are reported without aborting the rest.

**Shell scripts are unversioned and untested** → As with the rest of this project, nothing guards them. They are short and run by hand, so the exposure is limited, but a broken `all-status.sh` misreports the stack rather than failing loudly.

## Migration Plan

No data migration — nothing exists.

Rollout: create the tree, make the scripts executable, bring the stack up, confirm the status command reports healthy, then verify a client can connect on the documented connection string. Only then is `add-drizzle-db-setup` unblocked.

Rollback: `docker-all-down.sh --destroy-data` and delete `DevOps/`. No application code depends on this change until `add-drizzle-db-setup` lands, so reverting is contained.

## Open Questions

- **Which service comes second.** A mail catcher such as Mailpit is the likely next addition, since `add-credentials-auth-provider` sends verification and reset email — and a local catcher would remove that change's dependency on a real Resend key. Worth revisiting when that change is implemented rather than now.
- **Whether the app itself should eventually be containerised.** Running it on the host is simpler and keeps hot reload fast. Only worth reconsidering if host-versus-container environment differences start causing problems.
