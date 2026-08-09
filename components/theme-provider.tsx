"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Thin client wrapper around next-themes.
 *
 * Only this module needs to be a Client Component. `app/layout.tsx` stays a
 * Server Component: children passed through `{children}` are still rendered on
 * the server, because passing a server-rendered tree as a prop does not pull it
 * into the client bundle.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
