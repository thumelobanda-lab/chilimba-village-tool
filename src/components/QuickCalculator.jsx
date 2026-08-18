import React, { useState } from "react";

/**
 * A genuine arithmetic calculator (+, -, ×, ÷, %) — distinct from the
 * "Calculator" tab, which shows ledger totals (due/paid/balance), not a
 * general-purpose number pad. Opened via a small icon button, usable by
 * anyone signed in, admin or member, entirely client-side — no backend
 * call involved.
 */
export default function QuickCalculator({ onClose }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [pendingOp, setPendingOp] = useState(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const round = (n) => Math.round(n * 1e8) / 1e8; // trim floating point noise

  const inputDigit = (d) => {
    if (justEvaluated) {
      setDisplay(d);
      setJustEvaluated(false);
      return;
    }
    setDisplay(display === "0" ? d : display + d);
  };

  const inputDot = () => {
    if (justEvaluated) {
      setDisplay("0.");
      setJustEvaluated(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const clear = () => {
    setDisplay("0");
    setStored(null);
    setPendingOp(null);
    setJustEvaluated(false);
  };

  const applyOp = (a, b, op) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const chooseOp = (op) => {
    const current = parseFloat(display);
    if (stored !== null && pendingOp && !justEvaluated) {
      const result = applyOp(stored, current, pendingOp);
      setDisplay(Number.isFinite(result) ? String(round(result)) : "Error");
      setStored(Number.isFinite(result) ? result : null);
    } else {
      setStored(current);
    }
    setPendingOp(op);
    setJustEvaluated(false);
  };

  const evaluate = () => {
    if (stored === null || pendingOp === null) return;
    const current = parseFloat(display);
    const result = applyOp(stored, current, pendingOp);
    setDisplay(Number.isFinite(result) ? String(round(result)) : "Error");
    setStored(null);
    setPendingOp(null);
    setJustEvaluated(true);
  };

  const percent = () => {
    const current = parseFloat(display);
    setDisplay(String(round(current / 100)));
  };

  const backspace = () => {
    if (justEvaluated) return clear();
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const press = (label) => {
    if (label === "C") return clear();
    if (label === "⌫") return backspace();
    if (label === "%") return percent();
    if (label === "=") return evaluate();
    if (label === ".") return inputDot();
    if (["+", "-", "×", "÷"].includes(label)) return chooseOp(label);
    return inputDigit(label);
  };

  const rows = [
    ["C", "⌫", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
  ];

  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Calculator</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close calculator">✕</button>
        </div>
        <div className="calc-display">{display}</div>
        <div className="calc-keypad">
          {rows.flat().map((label) => (
            <button
              key={label}
              className={
                "calc-btn" +
                (["+", "-", "×", "÷"].includes(label) ? " calc-btn-op" : "") +
                (label === "C" || label === "⌫" || label === "%" ? " calc-btn-fn" : "")
              }
              onClick={() => press(label)}
            >
              {label}
            </button>
          ))}
          <button className="calc-btn calc-btn-zero" onClick={() => press("0")}>0</button>
          <button className="calc-btn" onClick={() => press(".")}>.</button>
          <button className="calc-btn calc-btn-equals" onClick={() => press("=")}>=</button>
        </div>
      </div>
    </div>
  );
}
