/**
 * Every timestamp column in worker/schema/schema.sql defaults to SQLite's
 * datetime('now') — "YYYY-MM-DD HH:MM:SS", genuinely UTC, but with no
 * "Z"/offset marker on the string itself. `new Date()` on a string in
 * that shape is parsed as LOCAL time in V8 (and inconsistently across
 * engines generally), which silently shifts it by the viewer's UTC
 * offset — harmless for something only ever *displayed*, but wrong for
 * real date math: a payment confirmed seconds ago can come out looking
 * like it happened hours in the future for a viewer west of UTC, which
 * is exactly what broke the notification bell's confirmed-payment item
 * during testing. Anything doing real math (not just formatting) on a
 * server timestamp should parse it through this first.
 */
export function parseServerTimestamp(value) {
  if (!value) return null;
  // Already unambiguous — an offset/Z marker, or a "T" separator — trust it as-is.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value) || value.includes("T")) return new Date(value);
  return new Date(value.replace(" ", "T") + "Z");
}
