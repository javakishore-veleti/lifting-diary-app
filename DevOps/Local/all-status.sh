#!/usr/bin/env bash
#
# Report the state of every local development service.
#
# Three states are distinguished, not two:
#
#   not running            nothing started
#   running, NOT healthy   started but not yet ready (or failing its healthcheck)
#   running, healthy       ready to accept work
#
# The middle state is the one worth the effort: "not ready yet" and "broken"
# produce identical symptoms for anything trying to connect, and without a way
# to tell them apart the natural response to a connection failure is to restart
# the stack -- which resets the initialisation it was in the middle of.
#
# Exits 0 when nothing is running. Status is a question, not an assertion, so a
# non-zero exit for "nothing is up" would make this unusable in a conditional.
#
# Usage: ./DevOps/Local/all-status.sh

set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "error: cannot reach the Docker engine, so service state is unknown." >&2
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

printf '%-22s %-26s %s\n' "SERVICE" "STATE" "PORTS"
printf '%-22s %-26s %s\n' "----------------------" "--------------------------" "-----"

for compose_file in "${compose_files[@]}"; do
  service_name="$(basename "$(dirname "$compose_file")")"

  container_ids="$(docker compose -f "$compose_file" ps -q 2>/dev/null || true)"

  if [ -z "$container_ids" ]; then
    printf '%-22s %-26s %s\n' "$service_name" "not running" "-"
    continue
  fi

  while IFS= read -r container_id; do
    [ -n "$container_id" ] || continue

    container_state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
    container_health="$(docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no healthcheck{{end}}' \
      "$container_id")"
    container_ports="$(docker inspect \
      --format '{{range $port, $bindings := .NetworkSettings.Ports}}{{if $bindings}}{{(index $bindings 0).HostIp}}:{{(index $bindings 0).HostPort}}->{{$port}} {{end}}{{end}}' \
      "$container_id")"

    [ -n "$container_ports" ] || container_ports="-"

    # Labels are kept within the STATE column width below. Do not embed the
    # raw health string in a longer phrase -- "running, NOT healthy
    # (unhealthy)" is 32 characters and overruns the column, misaligning PORTS.
    if [ "$container_state" != "running" ]; then
      state_label="not running ($container_state)"
    elif [ "$container_health" = "healthy" ]; then
      state_label="running, healthy"
    elif [ "$container_health" = "no healthcheck" ]; then
      # Visible symptom of a service added to this tree without a healthcheck:
      # `up --wait` had nothing to wait on for it.
      state_label="running, NO HEALTHCHECK"
    elif [ "$container_health" = "starting" ]; then
      state_label="running, starting"
    else
      state_label="running, UNHEALTHY"
    fi

    printf '%-22s %-26s %s\n' "$service_name" "$state_label" "$container_ports"
  done <<<"$container_ids"
done
