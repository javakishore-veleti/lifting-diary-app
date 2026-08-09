import { SignUp } from "@clerk/nextjs";

// See the sign-in route: the optional catch-all carries Clerk's multi-step
// registration flow.
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
