-- Make created_at the database's to assign, not the caller's.
--
-- A DEFAULT now() only supplies a value when the caller omits the column; an
-- explicit INSERT ... (created_at) VALUES ('1999-01-01') still wins. The
-- training-log spec requires the stored value to reflect the database's own
-- time regardless of what the caller supplies, so a trigger is needed.
--
-- UPDATE is covered too. Without it, "INSERT then UPDATE created_at" is a
-- trivial bypass of the INSERT trigger, and the column is meant to be an
-- immutable record of when the row was created.
--
-- HAND-WRITTEN. drizzle-kit does not model triggers, so this migration is not
-- reproducible by `db:generate` -- it will neither regenerate nor drop these
-- objects. Changes here must be made as another custom migration.

CREATE OR REPLACE FUNCTION set_created_at_from_database()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    -- Preserve the original value on update, whatever the caller passed.
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER exercises_created_at_immutable
BEFORE INSERT OR UPDATE ON "exercises"
FOR EACH ROW EXECUTE FUNCTION set_created_at_from_database();
--> statement-breakpoint

CREATE TRIGGER workouts_created_at_immutable
BEFORE INSERT OR UPDATE ON "workouts"
FOR EACH ROW EXECUTE FUNCTION set_created_at_from_database();
--> statement-breakpoint

CREATE TRIGGER sets_created_at_immutable
BEFORE INSERT OR UPDATE ON "sets"
FOR EACH ROW EXECUTE FUNCTION set_created_at_from_database();
