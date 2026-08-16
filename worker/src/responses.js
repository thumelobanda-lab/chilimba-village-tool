export function corsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  // Reflects the requesting Origin back only if it matches the configured
  // allowlist; otherwise falls back to the allowlist value itself (which
  // will correctly cause the browser to reject the response if it doesn't
  // match). Supports a comma-separated list in ALLOWED_ORIGIN for multiple
  // origins (e.g. a pages.dev preview URL alongside a custom domain).
  const allowList = allowed.split(",").map((o) => o.trim());
  const allowOrigin = allowed === "*" ? "*" : (allowList.includes(origin) ? origin : allowList[0]);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
