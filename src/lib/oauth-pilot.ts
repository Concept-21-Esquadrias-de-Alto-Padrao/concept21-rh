type AllowedClient = { id: string; redirectUri: string };

function validRedirect(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function allowedOAuthClients(): AllowedClient[] {
  const legacyId = process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID;
  const legacyRedirect = process.env.CENTRAL_OAUTH_ALLOWED_REDIRECT_URI;
  const result: AllowedClient[] = legacyId && legacyRedirect && validRedirect(legacyRedirect)
    ? [{ id: legacyId, redirectUri: legacyRedirect }]
    : [];

  const additional = process.env.CENTRAL_OAUTH_ADDITIONAL_CLIENTS;
  if (!additional) return result;
  try {
    const parsed: unknown = JSON.parse(additional);
    if (!Array.isArray(parsed) || parsed.length > 4) return result;
    const extraClients: AllowedClient[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" ||
          !("id" in entry) || typeof entry.id !== "string" || !entry.id ||
          !("redirectUri" in entry) || typeof entry.redirectUri !== "string" ||
          !validRedirect(entry.redirectUri) ||
          [...result, ...extraClients].some((client) => client.id === entry.id)) {
        return result;
      }
      extraClients.push({ id: entry.id, redirectUri: entry.redirectUri });
    }
    return [...result, ...extraClients];
  } catch {
    return result;
  }
}

export function isAllowedOAuthClient(clientId: string, redirectUri: string) {
  return allowedOAuthClients().some((client) =>
    client.id === clientId && client.redirectUri === redirectUri,
  );
}

export function isAllowedOAuthRedirect(candidate: string) {
  try {
    const target = new URL(candidate);
    return target.protocol === "https:" && !target.username && !target.password && !target.hash &&
      allowedOAuthClients().some((client) => {
        const allowed = new URL(client.redirectUri);
        return target.origin === allowed.origin && target.pathname === allowed.pathname;
      });
  } catch {
    return false;
  }
}
