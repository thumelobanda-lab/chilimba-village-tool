/**
 * Centralized admin-action audit log (`audit_log`, migration 026). A
 * handful of these actions already stamp a `*_by`/`*_at` pair onto their
 * own row (payments.confirmed_by, loan_edits, loan_repayments.recorded_by)
 * — this doesn't replace those, it's the one place an admin can read
 * every action type as a single group-scoped timeline (GET
 * /api/admin/audit-log) without knowing in advance which table a given
 * action landed in.
 */
import { uid } from "./crypto.js";

export const AUDIT_ACTIONS = {
  PROMOTE: "promote",
  DEMOTE: "demote",
  REMOVE: "remove",
  RESET_PIN: "reset_pin",
  PAYMENT_CONFIRM: "payment_confirm",
  PAYMENT_UNCONFIRM: "payment_unconfirm",
  PAYMENT_REJECT: "payment_reject",
  LOAN_ISSUE: "loan_issue",
  LOAN_REPAY: "loan_repay",
  LOAN_EDIT: "loan_edit",
  LOAN_REPAYMENT_VOID: "loan_repayment_void",
};

/**
 * Returns an unexecuted prepared statement, same pattern as
 * insertSession() in auth.js — callers fold it into their own
 * env.DB.batch([...]) alongside the mutation it's recording, so the
 * audit entry can never land without (or drift from) the action itself.
 */
export function logAdminAction(env, { groupId, actorName, action, targetName, detail }) {
  return env.DB.prepare(
    `INSERT INTO audit_log (id, group_id, actor_name, action, target_name, detail) VALUES (?,?,?,?,?,?)`
  ).bind(uid(), groupId, actorName, action, targetName || null, detail || null);
}
