export const PROTECTED_PREFIXES = ["/dashboard", "/ai-employees"];

export const AUTH_ROUTES = ["/login", "/signup"];

export type ProxyRedirect = "/login" | "/dashboard";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

export function resolveProxyRedirect(
  pathname: string,
  isAuthenticated: boolean,
): ProxyRedirect | null {
  if (!isAuthenticated && isProtectedPath(pathname)) {
    return "/login";
  }

  if (isAuthenticated && isAuthRoute(pathname)) {
    return "/dashboard";
  }

  return null;
}
