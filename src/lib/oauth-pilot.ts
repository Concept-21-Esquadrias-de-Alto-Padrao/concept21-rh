export function isAllowedOAuthRedirect(candidate: string) {
  const configured = process.env.CENTRAL_OAUTH_ALLOWED_REDIRECT_URI;
  if (!configured) return false;
  try {
    const allowed = new URL(configured);
    const target = new URL(candidate);
    return allowed.protocol === "https:" &&
      target.origin === allowed.origin &&
      target.pathname === allowed.pathname;
  } catch {
    return false;
  }
}
