import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Ownership is a plain Clerk user id (an opaque `user_...` string). There is no
// local users table and therefore no foreign key -- Clerk owns identity. Every
// owned table indexes it, because every read filters on it.
//
// NOTE: no database mechanism enforces ownership. A query missing its
// `where eq(table.userId, ...)` predicate returns another user's rows. The
// follow-up query layer must centralise access behind functions that take a
// userId as a required parameter.

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique per owner and case-insensitive: a lifter typing "back squat"
    // means their existing "Back Squat", and silently creating a near-duplicate
    // would fragment their history.
    uniqueIndex("exercises_user_id_lower_name_unique").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
    index("exercises_user_id_idx").on(table.userId),
    check("exercises_name_not_blank", sql`length(trim(${table.name})) > 0`),
  ],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    // The calendar date the session happened, distinct from created_at, which
    // is when the row was written. A session logged the next morning keeps the
    // date it was actually performed.
    sessionDate: date("session_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("workouts_user_id_idx").on(table.userId)],
);

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    // A workout's sets have no meaning without it, so they go with it.
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    // Deleting an exercise that has recorded sets would destroy training
    // history, so the database refuses rather than cascading.
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    reps: integer("reps").notNull(),
    // numeric(6,2) -- exact decimal storage up to 9999.99, well past any human
    // load. Binary floats (real/double precision) were rejected: they cannot
    // represent common plate weights exactly.
    //
    // mode: "number" is a deliberate, project-wide choice. Drizzle's default
    // maps numeric to `string`, which is precision-safe but invites the silent
    // bug where `weightA + weightB` concatenates instead of adding. Real plate
    // increments (1.25, 2.5, 5, 20) are binary-exact as doubles, and storage
    // stays exact regardless of this mapping, so `number` costs nothing here
    // and removes that whole class of bug. Do not mix modes across columns.
    weight: numeric("weight", { precision: 6, scale: 2, mode: "number" })
      .notNull(),
    // Caller-assigned order. Ordering by created_at was rejected: rows inserted
    // in one statement share a timestamp, leaving order undefined, and it would
    // prevent reordering a mis-entered set.
    position: smallint("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sets_user_id_idx").on(table.userId),
    index("sets_workout_id_idx").on(table.workoutId),
    index("sets_exercise_id_idx").on(table.exerciseId),
    // Integrity lives in the database, not only in application code, so these
    // hold regardless of which path writes.
    check("sets_reps_positive", sql`${table.reps} > 0`),
    // Zero is valid: bodyweight or unloaded movement.
    check("sets_weight_non_negative", sql`${table.weight} >= 0`),
  ],
);

// Row shapes for reads.
export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Set = typeof sets.$inferSelect;

// Row shapes for writes. `createdAt` is omitted deliberately: the timestamp is
// the database's to assign, so application code should not be able to supply
// one. See the caveat in README -- the column has a DEFAULT, not a trigger, so
// this is a TypeScript-level guarantee rather than a database-level one.
export type NewExercise = Omit<typeof exercises.$inferInsert, "createdAt">;
export type NewWorkout = Omit<typeof workouts.$inferInsert, "createdAt">;
export type NewSet = Omit<typeof sets.$inferInsert, "createdAt">;
