import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it does not load .env automatically and
// cannot import db/env.ts (that module is server-only and would fail to
// resolve here). Read and check the variable directly instead.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. drizzle-kit needs it to generate and apply " +
      "migrations. The db:generate and db:migrate scripts load it from .env.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  // Migrations are generated into ./drizzle and committed, then applied with
  // `npm run db:migrate`. `drizzle-kit push` is deliberately not used: it
  // diffs the schema straight onto the database with no artifact, which makes
  // changes invisible in review and unrepeatable across environments.
  strict: true,
  verbose: true,
});
