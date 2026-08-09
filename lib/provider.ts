// Which authentication provider is active.
//
// Server-only and deliberately NOT a NEXT_PUBLIC_ variable. NEXT_PUBLIC_ values
// are inlined into the client bundle at build time, which would freeze the
// provider per build rather than per environment. It is unnecessary anyway:
// app/layout.tsx and both auth pages are Server Components, so they read this
// on the server and send only the outcome to the client.
import "server-only";

export const AUTH_PROVIDERS = ["clerk", "credentials"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** Thrown when provider configuration is missing or unrecognised. */
export class AuthProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthProviderConfigError";
  }
}

function resolveProvider(): AuthProvider {
  const raw = process.env.AUTH_PROVIDER?.trim();

  // Absent means the hosted provider, which is the default.
  if (!raw) return "clerk";

  if (!(AUTH_PROVIDERS as readonly string[]).includes(raw)) {
    throw new AuthProviderConfigError(
      `AUTH_PROVIDER holds an unrecognised value. Accepted values are: ` +
        `${AUTH_PROVIDERS.join(", ")}. Unset it to use the default (clerk).`,
    );
  }

  return raw as AuthProvider;
}

export const AUTH_PROVIDER: AuthProvider = resolveProvider();
export const isClerk = AUTH_PROVIDER === "clerk";
export const isCredentials = AUTH_PROVIDER === "credentials";

/**
 * Fail closed on misconfiguration.
 *
 * There is deliberately no fallback to the other provider and no
 * "auth disabled" mode. A deploy with a missing key would otherwise start
 * silently unauthenticated, serving every protected route to anyone, and would
 * look healthy. Refusing to start turns a silent security failure into an
 * obvious deployment failure.
 */
function assertProviderConfigured(): void {
  const missing: string[] = [];

  if (AUTH_PROVIDER === "clerk") {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    }
    if (!process.env.CLERK_SECRET_KEY) missing.push("CLERK_SECRET_KEY");
  } else {
    if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
    // Required at startup rather than at first send: without it, registration
    // succeeds and then nobody can verify or recover an account -- a broken
    // state discovered only by users.
    if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (!process.env.EMAIL_FROM) missing.push("EMAIL_FROM");
  }

  if (missing.length > 0) {
    throw new AuthProviderConfigError(
      `AUTH_PROVIDER is "${AUTH_PROVIDER}" but required configuration is ` +
        `missing: ${missing.join(", ")}. The application will not start ` +
        `without it, deliberately -- it must never fall back to running ` +
        `unauthenticated.`,
    );
  }
}

assertProviderConfigured();
