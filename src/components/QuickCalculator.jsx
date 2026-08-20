import React, { useReducer } from "react";
import { initialCalcState, pressKey } from "../lib/calculatorEngine.js";

/**
 * A genuine arithmetic calculator (+, -, ×, ÷, %) — distinct from the
 * "Calculator" tab, which shows ledger totals (due/paid/balance), not a
 * general-purpose number pad. Opened via a small icon button, usable by
 * anyone signed in, admin or member, entirely client-side — no backend
 * call involved. The actual state machine lives in calculatorEngine.js
 * (tested separately) — this component is just the keypad UI dispatching
 * key presses into it.
 */
export default function QuickCalculator({ onClose }) {
  const [state, dispatch] = useReducer(pressKey, initialCalcState);

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
        <div className="calc-display">{state.display}</div>
        <div className="calc-keypad">
          {rows.flat().map((label) => (
            <button
              key={label}
              className={
                "calc-btn" +
                (["+", "-", "×", "÷"].includes(label) ? " calc-btn-op" : "") +
                (label === "C" || label === "⌫" || label === "%" ? " calc-btn-fn" : "")
              }
              onClick={() => dispatch(label)}
            >
              {label}
            </button>
          ))}
          <button className="calc-btn calc-btn-zero" onClick={() => dispatch("0")}>0</button>
          <button className="calc-btn" onClick={() => dispatch(".")}>.</button>
          <button className="calc-btn calc-btn-equals" onClick={() => dispatch("=")}>=</button>
        </div>
      </div>
    </div>
  );
}
