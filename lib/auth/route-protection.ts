const ORGANIZER_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/notifications",
  "/cloud",
  "/tournaments",
  "/leagues",
  "/tables",
  "/clubs/new",
];

export function isProtectedOrganizerPath(pathname: string) {
  if (pathname.startsWith("/cloud/live/")) return false;
  return ORGANIZER_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
