import { requireUserId } from "@/lib/auth";

// Deliberately trivial. This route exists to exercise route protection end to
// end -- signed-out redirect, deep-link return, and sign-out behaviour all
// need a protected route to act on. Real signed-in content lives on the
// landing page.
export default async function DashboardPage() {
  const userId = await requireUserId();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <code className="font-mono">{userId}</code>
      </p>
    </main>
  );
}
