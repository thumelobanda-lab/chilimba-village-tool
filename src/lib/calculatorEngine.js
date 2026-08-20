/**
 * Pure state machine behind QuickCalculator.jsx — a genuine four-function
 * calculator (+, -, ×, ÷, %), not the "Calculator" tab (which shows
 * ledger totals, not a number pad). Extracted into its own tested module
 * so the bug this fixes — chained operations requiring the user to
 * delete and retype a number — is covered by a test, not just eyeballed
 * in the UI.
 *
 * The bug: choosing an operator (e.g. "×") never reset what the next
 * digit press did to `display` — so "5", "×", "3" appended onto the
 * existing "5" to make "53" instead of starting fresh at "3", silently
 * turning 5×3 into 53. Fixed with `awaitingNewEntry`, set whenever the
 * next digit/dot press should replace the display instead of appending
 * to it — after choosing an operator, and after "=".
 */

export const initialCalcState = {
  display: "0",
  stored: null,
  pendingOp: null,
  awaitingNewEntry: false,
  // Narrower than awaitingNewEntry — true only right after "=", so
  // backspace's "clear everything" shortcut doesn't also fire the
  // instant an operator is chosen (that should still let you correct
  // the operand still on screen, not wipe the whole calculation).
  justEvaluated: false,
};

const OPERATORS = ["+", "-", "×", "÷"];

function round(n) {
  return Math.round(n * 1e8) / 1e8; // trim floating point noise
}

function applyOp(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function inputDigit(state, d) {
  if (state.awaitingNewEntry) {
    return { ...state, display: d, awaitingNewEntry: false, justEvaluated: false };
  }
  return { ...state, display: state.display === "0" ? d : state.display + d };
}

function inputDot(state) {
  if (state.awaitingNewEntry) {
    return { ...state, display: "0.", awaitingNewEntry: false, justEvaluated: false };
  }
  if (state.display.includes(".")) return state;
  return { ...state, display: state.display + "." };
}

// Chains left-to-right like a plain four-function calculator (no
// operator precedence): choosing a new operator while one is already
// pending immediately applies the pending one to the running total,
// same as the original component's behavior — this fix only touches
// what happens to `display` afterward, not the arithmetic order.
function chooseOp(state, op) {
  const current = parseFloat(state.display);
  let display = state.display;
  let stored = current;

  if (state.stored !== null && state.pendingOp && !state.awaitingNewEntry) {
    const result = applyOp(state.stored, current, state.pendingOp);
    display = Number.isFinite(result) ? String(round(result)) : "Error";
    stored = Number.isFinite(result) ? result : null;
  }

  return { ...state, display, stored, pendingOp: op, awaitingNewEntry: true, justEvaluated: false };
}

function evaluate(state) {
  if (state.stored === null || state.pendingOp === null) return state;
  const current = parseFloat(state.display);
  const result = applyOp(state.stored, current, state.pendingOp);
  return {
    ...state,
    display: Number.isFinite(result) ? String(round(result)) : "Error",
    stored: null,
    pendingOp: null,
    awaitingNewEntry: true,
    justEvaluated: true,
  };
}

function percent(state) {
  const current = parseFloat(state.display);
  return { ...state, display: String(round(current / 100)) };
}

function backspace(state) {
  if (state.justEvaluated) return { ...initialCalcState };
  const display = state.display.length > 1 ? state.display.slice(0, -1) : "0";
  return { ...state, display };
}

/**
 * Applies one key press to calculator state and returns the next state —
 * usable directly as a useReducer reducer. Mirrors the keypad's own
 * labels: a digit "0"-"9", ".", "C", "⌫", "%", "=", or an operator.
 *
 * @param {typeof initialCalcState} state
 * @param {string} label
 * @returns {typeof initialCalcState}
 */
export function pressKey(state, label) {
  if (label === "C") return { ...initialCalcState };
  if (label === "⌫") return backspace(state);
  if (label === "%") return percent(state);
  if (label === "=") return evaluate(state);
  if (label === ".") return inputDot(state);
  if (OPERATORS.includes(label)) return chooseOp(state, label);
  return inputDigit(state, label);
}
