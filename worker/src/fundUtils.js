// See src/lib/fundUtils.js in the frontend for the full explanation and
// the tests — duplicated here (not imported across directories) so the
// Worker stays deployable on its own.
export function crossedDueThreshold(paidBefore, paidAfter, due) {
  if (!due || due <= 0) return false;
  return paidBefore < due && paidAfter >= due;
}

export function fundsStillToCredit(funds, alreadyCreditedFundIds) {
  const already = new Set(alreadyCreditedFundIds);
  return funds.filter((f) => !already.has(f.id));
}
