/**
 * HTTP-level redirect for unauthenticated visitors hitting `/`.
 *
 * The app-side route middleware (`app/middleware/auth.ts`) does the same
 * via `navigateTo('/login')`, but in SSR that path re-renders /login at /
 * INSIDE Nuxt rather than issuing a 302. Unhead drops `<title>` during
 * that internal redirect, which broke iOS "Add to Home Screen" pre-fill.
 *
 * Handling the redirect here forces an actual 302 — Safari follows it to
 * /login proper, where the title + manifest + apple-touch-icon all render
 * cleanly.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return;
  const url = getRequestURL(event);
  if (url.pathname !== '/') return;

  const session = await getUserSession(event).catch(() => null);
  if (session?.user) return;

  return sendRedirect(event, '/login', 302);
});
