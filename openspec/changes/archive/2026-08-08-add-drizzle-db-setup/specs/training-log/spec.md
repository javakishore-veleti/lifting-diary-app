## Purpose

Defines the domain model for recording resistance training: the catalog of exercises a lifter can perform, the workout sessions they complete, and the individual sets performed within each session, together with the ownership and integrity rules that govern them.

## ADDED Requirements

### Requirement: Training records are owned by a single user

Every exercise, workout, and set SHALL be associated with exactly one authenticated user identity. The system MUST store that identity as supplied by the authentication provider and MUST NOT permit a record to exist without an owner.

#### Scenario: Record is created by a signed-in user

- **WHEN** a signed-in user creates a workout
- **THEN** the stored workout carries that user's identifier from the authentication provider

#### Scenario: Record is created without an owner

- **WHEN** an attempt is made to store a workout with no owner identifier
- **THEN** the write is rejected by the database
- **AND** no partial record is persisted

#### Scenario: Retrieving another user's records

- **WHEN** records are retrieved for a given user identifier
- **THEN** only records owned by that identifier are returned
- **AND** records belonging to other users are never included

### Requirement: Users maintain a catalog of exercises

The system SHALL allow a user to define named exercises that can be referenced by their workouts. An exercise name MUST be unique within the scope of its owner, so that two users may each have an exercise of the same name without collision.

#### Scenario: Creating an exercise

- **WHEN** a user creates an exercise with a name not already in their catalog
- **THEN** the exercise is stored and becomes available for use in workouts

#### Scenario: Creating a duplicate exercise name

- **WHEN** a user creates an exercise with a name already present in their own catalog
- **THEN** the write is rejected
- **AND** the existing exercise is left unchanged

#### Scenario: Two users use the same exercise name

- **WHEN** two different users each create an exercise named "Back Squat"
- **THEN** both are stored successfully as independent records

#### Scenario: Exercise name is empty

- **WHEN** a user attempts to create an exercise whose name is empty or only whitespace
- **THEN** the write is rejected

### Requirement: Users record workout sessions

The system SHALL allow a user to record a workout representing a single training session, carrying the date it occurred. A workout MAY exist with no sets recorded against it, representing a session in progress or one logged before its detail is entered.

#### Scenario: Recording a workout

- **WHEN** a user records a workout with a session date
- **THEN** the workout is stored with that date and is retrievable by its owner

#### Scenario: Workout with no sets

- **WHEN** a workout is stored with no sets
- **THEN** it is retained and retrievable
- **AND** it is reported as having zero sets rather than treated as invalid

#### Scenario: Listing workouts

- **WHEN** a user's workouts are listed
- **THEN** they are returned ordered by session date, most recent first

### Requirement: Sets record the work performed

The system SHALL allow a set to be recorded against a workout, identifying the exercise performed, the number of repetitions completed, and the weight used. Repetitions MUST be a positive whole number. Weight MUST NOT be negative, and a weight of zero is valid, representing bodyweight or unloaded movement.

#### Scenario: Recording a valid set

- **WHEN** a set is recorded with a positive repetition count and a non-negative weight
- **THEN** the set is stored and associated with its workout and exercise

#### Scenario: Recording zero or negative repetitions

- **WHEN** a set is recorded with a repetition count of zero or below
- **THEN** the write is rejected

#### Scenario: Recording negative weight

- **WHEN** a set is recorded with a negative weight
- **THEN** the write is rejected

#### Scenario: Recording a bodyweight set

- **WHEN** a set is recorded with a weight of zero
- **THEN** the set is stored successfully

#### Scenario: Weight requires fractional precision

- **WHEN** a set is recorded with a fractional weight such as 2.5
- **THEN** the stored value equals the supplied value exactly, without rounding drift

#### Scenario: Sets are ordered within a workout

- **WHEN** the sets of a workout are retrieved
- **THEN** they are returned in the order they were performed

### Requirement: Referenced records must exist

A set SHALL reference an existing workout and an existing exercise. The system MUST reject a set that references a record that does not exist, and MUST NOT leave sets referencing a deleted parent.

#### Scenario: Set references a missing workout

- **WHEN** a set is recorded against a workout identifier that does not exist
- **THEN** the write is rejected

#### Scenario: Set references a missing exercise

- **WHEN** a set is recorded against an exercise identifier that does not exist
- **THEN** the write is rejected

#### Scenario: Deleting a workout

- **WHEN** a workout is deleted
- **THEN** the sets recorded against it are deleted with it
- **AND** no set remains referencing the deleted workout

#### Scenario: Deleting an exercise still in use

- **WHEN** a user attempts to delete an exercise that is referenced by recorded sets
- **THEN** the deletion is rejected
- **AND** the historical sets and the exercise both remain intact

### Requirement: Records carry creation timestamps

Every exercise, workout, and set SHALL carry a timestamp recording when it was created, assigned by the database rather than the caller, so that ordering and auditing do not depend on client clocks.

#### Scenario: Creating a record

- **WHEN** any training record is created
- **THEN** a creation timestamp is stored
- **AND** its value is derived from the database rather than supplied by the caller

#### Scenario: Caller supplies a creation timestamp

- **WHEN** a caller attempts to set the creation timestamp explicitly
- **THEN** the stored value reflects the database's own time rather than the supplied value
