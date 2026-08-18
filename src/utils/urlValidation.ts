/** HTTPS root origin only — no path, query, hash, port, or userinfo. */
const ODOO_FETCH_URL_RE =
  /^https:\/\/(www\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

/** Trim and strip trailing slashes. */
export function sanitizeOdooFetchUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** True when `url` is an absolute HTTPS root like https://www.example.com. */
export function isValidOdooFetchUrl(url: string): boolean {
  const cleaned = sanitizeOdooFetchUrl(url);
  if (!ODOO_FETCH_URL_RE.test(cleaned)) {
    return false;
  }
  try {
    const parsed = new URL(cleaned);
    return (
      parsed.protocol === 'https:' &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
