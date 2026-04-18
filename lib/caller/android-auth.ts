/**
 * Android API Key Auth
 *
 * Since the Android app can't use Clerk sessions, we use a simple
 * pre-shared API key stored as CALLER_API_KEY in the environment.
 * Only Mike uses the Android app, so this is admin-only access.
 *
 * The Android app sends: Authorization: Bearer <CALLER_API_KEY>
 */

export function validateCallerApiKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "").trim();
  // Check both env vars — CALLER_API_TOKEN is the existing one used by leads/next
  const callerKey = process.env.CALLER_API_KEY || process.env.CALLER_API_TOKEN;

  if (!callerKey) {
    console.error("[android-auth] CALLER_API_KEY / CALLER_API_TOKEN env var not set");
    return false;
  }

  return token === callerKey;
}

/**
 * Combined auth: accepts either Clerk session OR API key.
 * Used in caller routes so both the web dashboard and Android app work.
 */
export async function requireCallerAuth(request: Request): Promise<boolean> {
  // First try API key (Android)
  if (validateCallerApiKey(request)) return true;

  // Fall through — Clerk auth handled by the route itself
  return false;
}
