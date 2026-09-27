/** Browser-origin check for the staging-only cookie-authenticated write route.
 * Reject absent/opaque origins; CORS is not an authorization mechanism.
 * Auth.getUser() and database RLS remain mandatory independent controls.
 */
export function isSameOriginReviewRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    return source.origin === target.origin &&
      source.protocol === "https:" &&
      source.pathname === "/" && source.search === "" && source.hash === "" &&
      source.username === "" && source.password === "" &&
      target.protocol === "https:";
  } catch {
    return false;
  }
}
