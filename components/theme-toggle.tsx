"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Three options, not a two-way flip: returning to "follow the system" after an
// explicit choice is a distinct state that a boolean toggle cannot express.
const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

// Mount detection without a setState-in-effect: the server snapshot is false
// and the client snapshot is true, so React resolves this during hydration
// rather than in a follow-up render. Both functions must be module-level so
// their identity is stable across renders.
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );

  // The resolved theme is unknown during the server pass, so rendering a
  // theme-dependent icon before mount is its own hydration mismatch --
  // separate from the <html> mismatch that suppressHydrationWarning covers.
  // Render a stable placeholder of identical size until mounted.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Change color scheme"
        disabled
      >
        <Sun className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change color scheme">
          <ActiveIcon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            // Exposes the current selection to assistive technology rather
            // than relying on a visual checkmark alone.
            aria-current={theme === value ? "true" : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {theme === value && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
