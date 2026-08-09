#!/usr/bin/env bash
#
# Bring every local development service up and wait until each is healthy.
#
# Services are discovered by globbing DevOps/Local/*/docker-compose.yaml, so
# adding a service requires no change to this script -- create its directory
# and compose file and it joins the stack.
#
# Usage: ./DevOps/Local/docker-all-up.sh

set -euo pipefail

# Resolve the stack directory from this script's own location, so the script
# works regardless of the directory it is invoked from.
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The engine being unavailable is by far the most common failure here, and the
# raw compose error buries the cause under connection noise. Check it first and
# say so plainly.
if ! docker info >/dev/null 2>&1; then
  echo "error: cannot reach the Docker engine." >&2
  echo "       Docker is installed but the daemon is not running." >&2
  echo "       Start Docker Desktop and try again:  open -a Docker" >&2
  exit 1
fi

shopt -s nullglob
compose_files=("$LOCAL_DIR"/*/docker-compose.yaml)
shopt -u nullglob

if [ ${#compose_files[@]} -eq 0 ]; then
  echo "No services found under $LOCAL_DIR/*/docker-compose.yaml"
  exit 0
fi

failed=()

for compose_file in "${compose_files[@]}"; do
  service_name="$(basename "$(dirname "$compose_file")")"
  echo "==> $service_name: starting"

  # --wait blocks until healthchecks pass and exits non-zero if any service
  # fails to become healthy. Without it this command returns as soon as
  # containers are *created* -- and Postgres restarts itself partway through
  # first-time initialisation, so anything connecting immediately afterwards
  # intermittently fails. That presents as a broken migration, not a race.
  if docker compose -f "$compose_file" up -d --wait; then
    echo "    $service_name: healthy"
  else
    # Report and continue rather than aborting the stack, so one bad service
    # definition does not prevent the others from starting.
    echo "    error: $service_name did not become healthy" >&2
    echo "           inspect it with:  docker compose -f $compose_file logs" >&2
    failed+=("$service_name")
  fi
done

echo

if [ ${#failed[@]} -gt 0 ]; then
  echo "failed to become healthy: ${failed[*]}" >&2
  exit 1
fi

echo "All services healthy. Check state with: $LOCAL_DIR/all-status.sh"
