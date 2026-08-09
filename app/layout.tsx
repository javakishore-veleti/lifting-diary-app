import type { Metadata } from "next";
import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lifting Diary",
  description: "Log your lifts, review your history, track your progress.",
};

// Clerk renders in this document rather than an iframe, so pointing its
// variables at the shadcn tokens makes it inherit the palette. Because those
// tokens are CSS variables that already change with the `dark` class, Clerk
// follows the active scheme without needing to know the theme -- one config
// covers both, with no branching and no hydration timing problem.
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "var(--card)",
    colorText: "var(--card-foreground)",
    colorTextSecondary: "var(--muted-foreground)",
    colorInputBackground: "var(--background)",
    colorInputText: "var(--foreground)",
    colorDanger: "var(--destructive)",
    colorNeutral: "var(--foreground)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-geist-sans)",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is load-bearing, not incidental: the server
    // cannot know the client's stored theme, so the class it renders
    // necessarily differs from what next-themes' pre-paint script stamps on
    // this element. Without it, that is a hydration error on every load.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* afterSignOutUrl is set here rather than on <UserButton>, which
              does not accept it in Clerk 7. Signing out lands on "/", a route
              reachable without a session -- the default would leave the user
              on a protected page they can no longer load. */}
          <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
            <header className="flex justify-end items-center gap-2 h-16 px-4 border-b">
              {/* Links to the dedicated routes rather than modal triggers.
                  Modals have no notion of a remembered destination, so mixing
                  both would give deep links different behaviour depending on
                  which control the user happened to use. */}
              <Show when="signed-out">
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Sign up</Link>
                </Button>
              </Show>
              <Show when="signed-in">
                {/* Sign out lands on a route reachable without a session --
                    the default would leave the user on a protected page they
                    can no longer load, which presents as an abrupt redirect. */}
                <UserButton />
              </Show>
              <ThemeToggle />
            </header>
            {children}
            <Toaster />
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
