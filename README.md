# lifting-diary-app

```sh

npm install -g @fission-ai/openspec@latest

openspec init

```

## Local development

### Prerequisites

- **Node.js 20.9.0 or newer.** Next.js 16 refuses to start on older versions.
- **Docker Desktop** (or any Docker engine with Compose v2+). The database runs in a container; `npm run dev` alone is not sufficient.

### Start the local stack

Backing services live under `DevOps/Local/`, one directory per service. Three scripts manage all of them:

```sh
./DevOps/Local/docker-all-up.sh      # start everything, wait until healthy
./DevOps/Local/all-status.sh         # report what is running and healthy
./DevOps/Local/docker-all-down.sh    # stop everything, keep data
```

`docker-all-up.sh` does not return until every service passes its healthcheck, so a command run straight afterwards can connect on its first attempt.

`all-status.sh` distinguishes three states, which matters because "not ready yet" and "broken" otherwise look identical to anything trying to connect:

```
SERVICE                STATE                      PORTS
---------------------- -------------------------- -----
Postgres               running, healthy           127.0.0.1:5432->5432/tcp
```

### Database connection string

Set this in `.env.local`:

```sh
DATABASE_URL=postgresql://lifting_diary:local_dev_only@localhost:5432/lifting_diary
```

These credentials are committed in `DevOps/Local/Postgres/docker-compose.yaml` on purpose, so the stack is reproducible from a clone with no setup step. They are safe only because the port is bound to `127.0.0.1` and unreachable from outside this machine. **Never reuse them for a deployed database.**

The port and credentials are fixed and survive restarts, so this string is written once and keeps working.

### Stopping and destroying data

`docker-all-down.sh` **preserves data.** Stop and start as often as you like; the database contents survive.

To delete the database entirely:

```sh
./DevOps/Local/docker-all-down.sh --destroy-data
```

This removes the persistent volume and cannot be undone. The next start initialises a fresh, empty database. The flag is deliberately explicit because `docker compose down -v` is one character from the safe form and easy to type by reflex.

### Troubleshooting

**"cannot reach the Docker engine"** — Docker Desktop is not running. Start it with `open -a Docker` and retry.

**Port 5432 already in use** — something else holds the port. Identify it with:

```sh
lsof -nP -iTCP:5432
```

A natively installed Postgres is the usual culprit. This machine has `postgresql@14` and `postgresql@15` installed via Homebrew; if either is running, stop it with `brew services stop postgresql@15`. Alternatively change the published port in `DevOps/Local/Postgres/docker-compose.yaml` and update `DATABASE_URL` to match.

**Container will not start after changing the Postgres version** — Postgres cannot read a data directory initialised by a different major version, and the error does not say so clearly. Changing the image tag requires destroying the volume:

```sh
./DevOps/Local/docker-all-down.sh --destroy-data
./DevOps/Local/docker-all-up.sh
```

### Adding a service

Create `DevOps/Local/<ServiceName>/docker-compose.yaml`. The three scripts discover services by globbing, so none of them needs editing.

**Every service must define a healthcheck.** The scripts rely on `docker compose up --wait`, which has nothing to wait on without one — `up` returns exit 0 while the service may not be ready, silently losing the readiness guarantee for the whole stack. `all-status.sh` reports such a service as `NO HEALTHCHECK`.
