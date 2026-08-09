import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Default-deny: everything requires a session unless it is listed here.
//
// The inversion is the point. A list of *protected* prefixes fails open --
// forget to add /workouts and it is silently public, with nothing in the type
// system or the build to catch it. Default-deny fails closed: forget to list a
// new public page and it demands a session, which is obvious the first time
// anyone loads it. A noisy failure beats a silent exposure.
//
// The `(.*)` suffixes are required, not decorative. Clerk routes its
// multi-step flows -- email verification, second factor, SSO callback,
// password reset -- through sub-paths beneath these URLs. Matching only the
// exact path leaves those sub-paths protected, so the middleware redirects the
// sign-in flow back to sign-in: a loop that presents as the page reloading
// endlessly. A single-step sign-in hides this completely.
//
// '/' must stay on this list. Omitting it locks every visitor out, with no
// route left to enter through.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  // Unchanged. Do NOT narrow this to only protected paths: the matcher decides
  // whether middleware runs *at all*, and Clerk needs it to run on public
  // routes too in order to populate session state for <Show> and auth(). It
  // also governs '/__clerk/', Clerk's own auto-proxy path -- excluding that
  // breaks authentication outright. Protection belongs in the body above.
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path
    '/__clerk/:path*',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
