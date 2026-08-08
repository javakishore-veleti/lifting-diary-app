#!/usr/bin/env bash
#
# Stop every local development service.
#
# Data is PRESERVED by default. Persistent volumes are removed only when
# --destroy-data is passed explicitly, because `docker compose down -v` is one
# character away from the safe form and is muscle memory for many people --
# losing the training database to a reflexive shutdown should not be possible.
#
# Usage:
#   ./DevOps/Local/docker-all-down.sh                  # stop, keep data
#   ./DevOps/Local/docker-all-down.sh --destroy-data   # stop, DELETE all data

set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: docker-all-down.sh [--destroy-data]

  (no options)     Stop all services. Persistent data is kept.
  --destroy-data   Stop all services AND delete their persistent volumes.
                   This permanently destroys the local database contents.
  -h, --help       Show this message.
EOF
}

destroy_data=0

for arg in "$@"; do
  case "$arg" in
    --destroy-data)
      destroy_data=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $arg" >&2
      echo >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

if [ "$destroy_data" -eq 1 ]; then
  echo "WARNING: --destroy-data was passed."
  echo "         Persistent volumes will be REMOVED and all local database"
  echo "         contents permanently destroyed."
  echo
fi

failed=()

for compose_file in "${compose_files[@]}"; do
  service_name="$(basename "$(dirname "$compose_file")")"

  if [ "$destroy_data" -eq 1 ]; then
    echo "==> $service_name: stopping and removing volumes"
    if docker compose -f "$compose_file" down -v; then
      echo "    $service_name: stopped, data destroyed"
    else
      echo "    error: $service_name failed to stop cleanly" >&2
      failed+=("$service_name")
    fi
  else
    echo "==> $service_name: stopping (data preserved)"
    # Deliberately no -v. Volumes survive so that a stop/start cycle keeps
    # the database intact.
    if docker compose -f "$compose_file" down; then
      echo "    $service_name: stopped"
    else
      echo "    error: $service_name failed to stop cleanly" >&2
      failed+=("$service_name")
    fi
  fi
done

echo

if [ ${#failed[@]} -gt 0 ]; then
  echo "failed to stop cleanly: ${failed[*]}" >&2
  exit 1
fi

if [ "$destroy_data" -eq 1 ]; then
  echo "All services stopped. PERSISTENT DATA WAS DESTROYED."
  echo "The next start will initialise a fresh, empty database."
else
  echo "All services stopped. Data preserved."
fi
