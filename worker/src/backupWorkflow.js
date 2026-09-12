import { WorkflowEntrypoint } from "cloudflare:workers";

/**
 * Daily D1 → R2 backup, run as a Cloudflare Workflow (not a plain
 * scheduled() handler like reminders.js) because a D1 export is a
 * multi-step, potentially slow async job — kick off the export, then
 * poll Cloudflare's own D1 export API until it's done, which the docs
 * are explicit can take a while for a larger database. Workflows give
 * each step its own automatic retry and durable state across the
 * poll loop; a bare scheduled() handler would have to redo everything
 * from scratch if a single fetch failed partway through, and risks the
 * handler's own execution limits on a slow export. See
 * https://developers.cloudflare.com/workflows/examples/backup-d1/ —
 * this mirrors Cloudflare's own reference implementation for exactly
 * this job.
 *
 * Reuses the AVATARS R2 binding (same bucket profile photos already
 * live in — see routes/profilePhoto.js) under a `backups/` key prefix
 * instead of `avatars/`, per the instruction to keep backups in their
 * own folder rather than provisioning a second bucket. No new R2
 * binding or permission is needed: the Worker already has full
 * read/write/list/delete on this bucket for photo uploads, and that's
 * exactly what backup put/list/delete need too.
 *
 * `D1_EXPORT_API_TOKEN` is the one genuinely new credential this
 * needs — a Cloudflare API Token (Account > D1 > Edit), set via
 * `wrangler secret put D1_EXPORT_API_TOKEN` (and `--env staging`).
 * This is deliberately separate from whatever token/OAuth session a
 * human uses to run `wrangler` themselves: the Worker needs its own
 * credential to call the D1 REST export endpoint at runtime, on a
 * schedule, with nobody signed in.
 */

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const RETENTION_DAYS = 7;
const MAX_POLL_ATTEMPTS = 60; // 60 * 10s ≈ 10 minutes of polling before giving up

async function callExportApi({ accountId, databaseId, token, currentBookmark }) {
  const res = await fetch(`${CF_API_BASE}/accounts/${accountId}/d1/database/${databaseId}/export`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      currentBookmark ? { output_format: "polling", current_bookmark: currentBookmark } : { output_format: "polling" }
    ),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(`D1 export API error (${res.status}): ${JSON.stringify(body?.errors || body)}`);
  }
  return body.result;
}

// R2's list() paginates (default page size well above what this ever
// produces — one backup a day, pruned after a week — but handled
// properly anyway rather than assuming it'll always fit in one page).
async function listAllBackups(bucket, prefix) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export class D1BackupWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const { CF_ACCOUNT_ID, D1_DATABASE_ID, D1_DATABASE_NAME, D1_EXPORT_API_TOKEN, AVATARS } = this.env;
    const prefix = `backups/${D1_DATABASE_NAME}/`;

    let exportResult = await step.do("start D1 export", async () =>
      callExportApi({ accountId: CF_ACCOUNT_ID, databaseId: D1_DATABASE_ID, token: D1_EXPORT_API_TOKEN })
    );

    let attempt = 0;
    while (exportResult.status !== "complete") {
      if (exportResult.status === "error") {
        throw new Error(`D1 export failed: ${exportResult.error || "unknown error"}`);
      }
      attempt++;
      if (attempt > MAX_POLL_ATTEMPTS) {
        throw new Error(`D1 export never completed after ${MAX_POLL_ATTEMPTS} polls — giving up.`);
      }
      await step.sleep(`wait before poll ${attempt}`, "10 seconds");
      const bookmark = exportResult.at_bookmark;
      exportResult = await step.do(`poll D1 export (attempt ${attempt})`, async () =>
        callExportApi({ accountId: CF_ACCOUNT_ID, databaseId: D1_DATABASE_ID, token: D1_EXPORT_API_TOKEN, currentBookmark: bookmark })
      );
    }

    const { filename, signed_url: signedUrl } = exportResult.result;

    const key = await step.do("download export and store in R2", async () => {
      const res = await fetch(signedUrl);
      if (!res.ok || !res.body) throw new Error(`Could not download D1 export (${res.status}).`);
      // Timestamp-prefixed so keys sort chronologically and never
      // collide even if a run is retried the same day.
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const objectKey = `${prefix}${stamp}-${filename}`;
      await AVATARS.put(objectKey, res.body, { httpMetadata: { contentType: "application/sql" } });
      return objectKey;
    });

    const pruned = await step.do("prune backups older than retention window", async () => {
      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const all = await listAllBackups(AVATARS, prefix);
      const stale = all.filter((o) => o.uploaded.getTime() < cutoff);
      await Promise.all(stale.map((o) => AVATARS.delete(o.key)));
      return stale.map((o) => o.key);
    });

    return { key, pruned };
  }
}
