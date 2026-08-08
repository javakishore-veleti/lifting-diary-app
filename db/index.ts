// The shared database client. Server-side code imports `db` from here rather
// than constructing its own connection.
//
// Server-only: importing this from a client component fails the build instead
// of shipping a connection string to the browser.
import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { DATABASE_URL } from "./env";
import * as schema from "./schema";

// One pool for the process, reused across requests.
//
// Next.js dev mode re-evaluates modules on hot reload, which would otherwise
// leak a new pool per reload until the connection limit is reached. Stashing it
// on globalThis keeps a single pool across reloads. In production the module is
// evaluated once and this is simply the first assignment.
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

const pool = globalForDb.__dbPool ?? new Pool({ connectionString: DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbPool = pool;
}

/** Thrown when the database cannot be reached at all, as opposed to a query failing. */
export class DatabaseUnreachableError extends Error {
  constructor(cause: unknown) {
    super(
      "Cannot reach the database. It is configured but nothing is listening " +
        "at the configured host and port.\n" +
        "If you are working locally, start it with:\n" +
        "  ./DevOps/Local/docker-all-up.sh\n" +
        "Check its state with:\n" +
        "  ./DevOps/Local/all-status.sh",
      { cause },
    );
    this.name = "DatabaseUnreachableError";
  }
}

const CONNECTION_FAILURE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

// Connection failures otherwise surface as the driver's raw ECONNREFUSED
// wrapped in Drizzle's "Failed query: select ..." message, which names the
// query rather than the cause and gives no hint that the container is down.
function isConnectionFailure(error: unknown): boolean {
  const seen: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: string; errors?: unknown[]; cause?: unknown };
    if (typeof candidate.code === "string") seen.push(candidate.code);
    // node-postgres surfaces multi-address failures as an AggregateError.
    if (Array.isArray(candidate.errors)) {
      for (const nested of candidate.errors) {
        const nestedCode = (nested as { code?: string } | null)?.code;
        if (typeof nestedCode === "string") seen.push(nestedCode);
      }
    }
    current = candidate.cause;
  }

  return seen.some((code) => CONNECTION_FAILURE_CODES.has(code));
}

// Both forms of connect() must be wrapped. Pool.query() -- which is what
// Drizzle actually calls -- acquires its client through the *callback* form,
// so patching only the promise form silently misses every query path.
const originalConnect = pool.connect.bind(pool);

type ConnectCallback = (err: unknown, client?: unknown, done?: unknown) => void;

pool.connect = function patchedConnect(this: Pool, ...args: unknown[]) {
  const callback = args[0];

  if (typeof callback === "function") {
    return (originalConnect as (cb: ConnectCallback) => void)(
      (err, client, done) => {
        (callback as ConnectCallback)(
          err && isConnectionFailure(err) ? new DatabaseUnreachableError(err) : err,
          client,
          done,
        );
      },
    );
  }

  return (originalConnect as () => Promise<unknown>)().catch((error: unknown) => {
    throw isConnectionFailure(error) ? new DatabaseUnreachableError(error) : error;
  });
} as typeof pool.connect;

/**
 * Drizzle client bound to the project schema.
 *
 * Backed by `node-postgres`, which supports interactive transactions -- so
 * `db.transaction(async (tx) => { ... })` works. Neon's HTTP driver does not;
 * that constraint is why this driver was chosen. Keep it in mind before
 * switching drivers, since transactional code would break at runtime only.
 */
export const db = drizzle(pool, { schema });

export { schema };
