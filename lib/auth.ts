// The single source of user identity for server-side code.
//
// Server-only: importing this from a client component fails the build rather
// than shipping auth internals to the browser.
import "server-only";

import { auth } from "@clerk/nextjs/server";

/** Thrown when server code demands an identity and no session exists. */
export class UnauthenticatedError extends Error {
  constructor() {
    // Deliberately carries no request data -- no path, no parameters, no
    // headers. This message reaches logs.
    super("No authenticated session. This operation requires a signed-in user.");
    this.name = "UnauthenticatedError";
  }
}

/**
 * The current user's identifier, or a thrown error if there is no session.
 *
 * The return type is the point of this function. Clerk's `auth()` yields
 * `userId: string | null`, so every call site must handle the null -- and the
 * ones that "handle" it by coercing (`userId!`, `userId ?? ""`) produce queries
 * scoped to an empty owner, silently reading or writing the wrong rows.
 * Returning `Promise<string>` removes the null from the type, so the unsafe
 * path stops being expressible.
 *
 * Every Server Action and route handler MUST call this as its first statement.
 * Middleware guards navigations; it does not reliably guard those, so this is
 * the layer that actually protects data.
 */
export async function requireUserId(): Promise<string> {
  // `auth()` is async in @clerk/nextjs 7. A missing await yields a Promise,
  // which is truthy, so `userId` would be undefined and every check would
  // silently pass.
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthenticatedError();
  }

  return userId;
}

/**
 * The current user's identifier, or null when there is no session.
 *
 * For code that legitimately branches on whether a user is signed in rather
 * than demanding one. Exists so such callers do not reach back to raw `auth()`
 * and reintroduce the nullable type `requireUserId` exists to remove.
 */
export async function getOptionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
