/**
 * API layer entry point.
 *
 * The implementation lives in src/lib/api/ split by domain (auth,
 * profile, schedule, contributions, funds, reconciliation, reminders,
 * subscription) — this file just re-exports everything from one place,
 * so every component's `import { x } from "../lib/api.js"` keeps working
 * unchanged. See src/lib/api/core.js for MOCK_MODE and the shared
 * plumbing every domain module depends on.
 */
export * from "./api/core.js";
export * from "./api/auth.js";
export * from "./api/profile.js";
export * from "./api/schedule.js";
export * from "./api/contributions.js";
export * from "./api/funds.js";
export * from "./api/members.js";
export * from "./api/reconciliation.js";
export * from "./api/reminders.js";
export * from "./api/subscription.js";
export * from "./api/notices.js";
