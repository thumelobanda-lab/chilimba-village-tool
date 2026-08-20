import { useCallback, useEffect, useMemo, useState } from "react";
import { isRecipient as isRecipientHelper } from "../lib/scheduleUtils.js";
import { computeLedgerTotals } from "../lib/ledgerMath.js";
import {
  getMyLedger,
  addPayment,
  voidPayment,
  savePayoutInfo,
  setDueOverride,
  setFlatRateForDates,
  deleteMyData,
} from "../lib/api.js";

const emptyLedger = () => ({ payments: [], payoutInfo: { amount: 0, date: "" }, dueOverrides: {} });

/**
 * Owns the signed-in member's ledger: state, every mutation
 * (add/void a payment, set a due override, record a payout, the
 * onboarding bulk-rate call, delete-my-data), and the derived totals
 * used by both the ledger table and the calculator tab. Every mutation
 * reloads from the source of truth afterward rather than trying to keep
 * local state in sync by hand — simpler, and correct even if two tabs
 * are open.
 */
export function useLedger(session, config) {
  const [ledger, setLedger] = useState(emptyLedger());

  const reload = useCallback(async () => {
    if (!session) return;
    const l = await getMyLedger();
    setLedger(l);
  }, [session]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isRecipientRow = useCallback(
    (row) => isRecipientHelper(row, session?.name, config.recipientExempt),
    [session, config.recipientExempt]
  );

  const totals = useMemo(
    () =>
      computeLedgerTotals({
        schedule: config.schedule,
        ledger,
        sessionName: session?.name,
        recipientExempt: config.recipientExempt,
      }),
    [config, ledger, session]
  );

  const addPaymentAndReload = async (scheduleRowId, amount) => {
    await addPayment({ scheduleRowId, amount });
    await reload();
  };

  const voidPaymentAndReload = async (paymentId) => {
    await voidPayment(paymentId);
    await reload();
  };

  // "Editing" a logged entry's amount in place — kept append-only under
  // the hood, same invariant every other ledger mutation preserves: the
  // old entry is voided (stays visible, struck through, tagged as
  // superseded) and a fresh entry is logged for the corrected amount,
  // rather than overwriting amount on the existing row. If the voided
  // entry had already been confirmed by an admin, the new one starts
  // unconfirmed again — a changed amount genuinely does need re-checking.
  const editPaymentAndReload = async (paymentId, scheduleRowId, amount) => {
    await voidPayment(paymentId, "Edited — replaced by a corrected entry");
    await addPayment({ scheduleRowId, amount });
    await reload();
  };

  const setDueOverrideAndReload = async (scheduleRowId, amount) => {
    await setDueOverride(scheduleRowId, amount);
    await reload();
  };

  const updatePayout = async (field, value) => {
    const next = { ...ledger.payoutInfo, [field]: field === "amount" ? Number(value) || 0 : value };
    setLedger({ ...ledger, payoutInfo: next }); // optimistic — payout is a single field, not append-only
    await savePayoutInfo(next);
  };

  const applyFlatRate = async (scheduleRowIds, rate) => {
    await setFlatRateForDates(scheduleRowIds, rate);
    await reload();
  };

  const clearMyData = async () => {
    await deleteMyData();
    setLedger(emptyLedger());
  };

  return {
    ledger,
    totals,
    isRecipientRow,
    addPayment: addPaymentAndReload,
    voidPayment: voidPaymentAndReload,
    editPayment: editPaymentAndReload,
    setDueOverride: setDueOverrideAndReload,
    updatePayout,
    applyFlatRate,
    clearMyData,
  };
}
