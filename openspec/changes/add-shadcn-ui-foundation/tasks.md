## 1. Initialise shadcn

- [ ] 1.1 Record the current contents of `app/globals.css` before running anything, so the initialiser's rewrite can be diffed against it
- [ ] 1.2 Run `npx shadcn@latest init`, selecting the `neutral` base color
- [ ] 1.3 Confirm `components.json`, `lib/utils.ts`, and the `cn()` helper were created
- [ ] 1.4 Confirm `components.json` aliases resolve through the existing `@/*` path mapping and point at `components/` and `lib/` at the repo root

## 2. Reconcile the token layer

- [ ] 2.1 Diff `app/globals.css` against the pre-init contents and identify what the initialiser removed
- [ ] 2.2 Re-add the `--font-sans` and `--font-mono` mappings to `--font-geist-sans` and `--font-geist-mono` inside `@theme inline` if the initialiser dropped them
- [ ] 2.3 Delete the `body { font-family: Arial, Helvetica, sans-serif }` rule — it overrides the `next/font` setup that `app/layout.tsx` wires up
- [ ] 2.4 Delete the `@media (prefers-color-scheme: dark)` block; the class strategy replaces it and leaving both creates two competing dark-mode mechanisms
- [ ] 2.5 Confirm `@custom-variant dark` is present so Tailwind v4 resolves `dark:` against the class rather than the media query
- [ ] 2.6 Confirm the full token set is defined for both schemes and that no orphaned token from the original file remains

## 3. Theme provider and toggle

- [ ] 3.1 Install `next-themes`
- [ ] 3.2 Create `components/theme-provider.tsx` marked `"use client"`, re-exporting the `next-themes` provider
- [ ] 3.3 Wrap the layout body content in the provider with `attribute="class"`, `defaultTheme="system"`, and `enableSystem`
- [ ] 3.4 Add `suppressHydrationWarning` to the `<html>` element in `app/layout.tsx` — without it every load logs a hydration error, since the server cannot know the client's stored theme
- [ ] 3.5 Confirm `app/layout.tsx` remains a Server Component and still uses the generated `LayoutProps<"/">` type
- [ ] 3.6 Create `components/theme-toggle.tsx` marked `"use client"` offering light, dark, and system as three distinct options, not a two-way flip
- [ ] 3.7 Render a stable placeholder in the toggle until mounted, so the theme-dependent icon does not become its own hydration mismatch
- [ ] 3.8 Place the toggle in the header in `app/layout.tsx`

## 4. Generate the component set

- [ ] 4.1 Generate the primitives: `npx shadcn@latest add button input label card`
- [ ] 4.2 Generate the composites: `npx shadcn@latest add form table dialog select sonner`
- [ ] 4.3 Confirm `react-hook-form` and `zod` were installed as part of `form`
- [ ] 4.4 Mount the `sonner` Toaster in `app/layout.tsx`
- [ ] 4.5 Read through the generated source in `components/ui/` once — it is now project-owned code, not a dependency
- [ ] 4.6 Confirm generated components reference tokens rather than hard-coded color values

## 5. Theme Clerk to match

- [ ] 5.1 Add an `appearance` config to `<ClerkProvider>` mapping Clerk's variables to the shadcn tokens
- [ ] 5.2 Replace the hand-written purple Sign Up button with the shared `Button` passed as the `<SignUpButton>` child
- [ ] 5.3 Verify the header reads as one visual language in light mode
- [ ] 5.4 Verify sign-in, sign-up, and the user button menu each follow the active scheme in both light and dark
- [ ] 5.5 Where a Clerk element is unreachable through `appearance` variables, accept its default rather than overriding via Clerk's internal class names, which break on Clerk updates

## 6. Rebuild the landing page

- [ ] 6.1 Remove all `create-next-app` template content from `app/page.tsx`, including the Next.js logo, template copy, and footer links
- [ ] 6.2 Build a signed-out panel using `Card` and `Button`, gated by `<Show when="signed-out">`
- [ ] 6.3 Build a signed-in placeholder dashboard using `Card` and `Table` with static rows, gated by `<Show when="signed-in">`
- [ ] 6.4 Confirm no data-layer imports are introduced — `add-drizzle-db-setup` is unimplemented and this screen is proof of the UI foundation only
- [ ] 6.5 Delete the now-unused template SVGs from `public/` if nothing else references them

## 7. Verify behaviour against the specs

- [ ] 7.1 With no stored preference and the OS set to dark, confirm the app opens dark; repeat with the OS set to light
- [ ] 7.2 Change the OS preference while the app is open with no explicit override set, and confirm the app follows without a reload
- [ ] 7.3 Select each of light, dark, and system, and confirm each applies immediately with no reload
- [ ] 7.4 Choose dark, reload, and confirm dark persists; then set the OS to dark, choose light explicitly, and confirm light wins
- [ ] 7.5 Reload with dark stored and confirm the first painted frame is dark, with no light flash
- [ ] 7.6 Confirm the browser console reports no hydration mismatch warnings on any page
- [ ] 7.7 Tab through the landing page and confirm every interactive element is reachable with a visible focus indicator
- [ ] 7.8 Open a dialog and confirm focus enters it, stays confined while open, can be dismissed from the keyboard, and returns to the trigger on close
- [ ] 7.9 Confirm the theme toggle is keyboard operable and exposes its current selection to assistive technology
- [ ] 7.10 Spot-check text contrast against its background in both schemes for WCAG AA at the relevant text size

## 8. Documentation and checks

- [ ] 8.1 Note in `CLAUDE.md` that `components/ui/` is generated shadcn source — owned, committed, not updated by `npm update`, and regenerated deliberately
- [ ] 8.2 Note in `CLAUDE.md` that dark mode uses the class strategy via `next-themes`, so `prefers-color-scheme` must not be reintroduced
- [ ] 8.3 Run `npx tsc --noEmit` and confirm it passes
- [ ] 8.4 Run `npm run lint` and confirm it passes
- [ ] 8.5 Run `npm run build` and confirm it succeeds; note the bundle size change from the added dependencies rather than assuming it is negligible
- [ ] 8.6 Confirm the rendered typeface is Geist rather than the browser default, verifying task 2.2 actually held
