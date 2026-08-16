/**
 * A small router replacing the sequential `path === X && method === Y`
 * if-chain that used to make up the whole Worker. Supports `:param`
 * segments (e.g. "/api/admin/loans/:id/repay").
 *
 * Each route handler receives a single context object:
 *   { request, env, ctx, url, params, cors }
 * and returns a Response (typically via json() from responses.js).
 */
export function createRouter() {
  const routes = [];

  function addRoute(method, pattern, handler) {
    const paramNames = [];
    const regexStr =
      "^" +
      pattern
        .split("/")
        .map((segment) => {
          if (segment.startsWith(":")) {
            paramNames.push(segment.slice(1));
            return "([^/]+)";
          }
          return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "$";
    routes.push({ method, regex: new RegExp(regexStr), paramNames, pattern, handler });
  }

  const router = {
    get: (pattern, handler) => addRoute("GET", pattern, handler),
    post: (pattern, handler) => addRoute("POST", pattern, handler),
    put: (pattern, handler) => addRoute("PUT", pattern, handler),
    del: (pattern, handler) => addRoute("DELETE", pattern, handler),

    // Lets route modules attach their handlers without index.js needing
    // to know each route's exact shape — see routes/*.js.
    use(registerFn) {
      registerFn(router);
    },

    /**
     * Finds and calls the first matching route. Returns null if nothing
     * matches, so the caller can respond with its own 404.
     */
    async handle({ request, env, ctx, url, cors }) {
      for (const route of routes) {
        if (route.method !== request.method) continue;
        const match = route.regex.exec(url.pathname);
        if (!match) continue;

        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });

        return route.handler({ request, env, ctx, url, params, cors });
      }
      return null;
    },
  };

  return router;
}
