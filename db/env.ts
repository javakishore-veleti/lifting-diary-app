// Database configuration, validated once at module load.
//
// This module is server-only: importing it from a client component fails the
// build rather than shipping a connection string to the browser.
import "server-only";

/**
 * Thrown when database configuration is missing or malformed.
 *
 * Never carries the connection string. The value embeds credentials and error
 * messages reach logs, so only the variable *name* and the nature of the
 * problem are reported.
 */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (value === undefined || value.trim() === "") {
    throw new DatabaseConfigError(
      "DATABASE_URL is not set. The application cannot run without it. " +
        "Copy .env.example to .env and set DATABASE_URL, then start the local " +
        "database with ./DevOps/Local/docker-all-up.sh",
    );
  }

  // Parse before any connection is attempted, so a malformed value fails
  // immediately and obviously rather than as a driver-level connection error.
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DatabaseConfigError(
      "DATABASE_URL is not a valid URL. Expected a Postgres connection string " +
        "of the form postgresql://user:password@host:port/database",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DatabaseConfigError(
      `DATABASE_URL must use the postgres: or postgresql: protocol, but its ` +
        `protocol is ${parsed.protocol.replace(":", "")}. Expected a Postgres ` +
        "connection string.",
    );
  }

  return value;
}

/** The validated Postgres connection string. Non-optional by construction. */
export const DATABASE_URL: string = readDatabaseUrl();
