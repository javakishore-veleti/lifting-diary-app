import { SignIn } from "@clerk/nextjs";

// Optional catch-all segment is required, not stylistic: Clerk routes its
// multi-step flows (email verification, second factor, SSO callback) through
// sub-paths beneath this URL. A plain page.tsx returns 404 for every step
// after the first, and password reset lives here too.
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignIn />
    </main>
  );
}
