import { describe, it, expect } from "vitest";
import { initialCalcState, pressKey } from "./calculatorEngine.js";

function run(keys) {
  return keys.reduce((state, key) => pressKey(state, key), initialCalcState);
}

describe("chained operations (the reported bug)", () => {
  it("5 × 3 = gives 15, not 53 — the digit after an operator must not append to the old display", () => {
    const state = run(["5", "×", "3", "="]);
    expect(state.display).toBe("15");
  });

  it("does not append the next digit onto the display right after choosing an operator", () => {
    const state = run(["5", "×"]);
    const next = pressKey(state, "3");
    expect(next.display).toBe("3"); // not "53"
  });

  it("chains multiple operators left-to-right: (5 + 3) × 2 = 16", () => {
    const state = run(["5", "+", "3", "×", "2", "="]);
    expect(state.display).toBe("16");
  });

  it("supports a long chain: 10 - 2 × 3 ÷ 4 = 6", () => {
    // left-to-right, no operator precedence: ((10-2)*3)/4 = 6
    const state = run(["1", "0", "-", "2", "×", "3", "÷", "4", "="]);
    expect(state.display).toBe("6");
  });

  it("multi-digit operands are typed normally (not affected by the operator reset)", () => {
    const state = run(["1", "2", "5", "+", "7", "5", "="]);
    expect(state.display).toBe("200");
  });
});

describe("digit and decimal entry", () => {
  it("replaces the leading zero instead of prefixing it", () => {
    expect(run(["5"]).display).toBe("5");
  });

  it("builds up a multi-digit number", () => {
    expect(run(["1", "2", "3"]).display).toBe("123");
  });

  it("supports one decimal point", () => {
    expect(run(["1", ".", "5"]).display).toBe("1.5");
  });

  it("ignores a second decimal point", () => {
    expect(run(["1", ".", "5", "."]).display).toBe("1.5");
  });

  it("starts a fresh number with a leading '0.' if '.' is the first key after an operator", () => {
    const state = run(["5", "+", "."]);
    expect(state.display).toBe("0.");
  });
});

describe("equals and re-entry", () => {
  it("starts a fresh number on the next digit after '=' instead of appending to the result", () => {
    const evaluated = run(["5", "×", "3", "="]);
    const next = pressKey(evaluated, "7");
    expect(next.display).toBe("7"); // not "157"
  });

  it("does nothing if '=' is pressed with no pending operation", () => {
    const state = run(["5", "="]);
    expect(state.display).toBe("5");
  });

  it("division by zero shows Error", () => {
    const state = run(["5", "÷", "0", "="]);
    expect(state.display).toBe("Error");
  });
});

describe("percent", () => {
  it("converts the display to a hundredth of itself", () => {
    expect(run(["5", "0", "%"]).display).toBe("0.5");
  });
});

describe("backspace", () => {
  it("deletes the last digit while entering a number", () => {
    expect(run(["1", "2", "3", "⌫"]).display).toBe("12");
  });

  it("floors at '0' rather than going empty", () => {
    expect(run(["5", "⌫"]).display).toBe("0");
  });

  it("clears the whole calculation instead of editing the result, right after '='", () => {
    const evaluated = run(["5", "×", "3", "="]);
    const next = pressKey(evaluated, "⌫");
    expect(next).toEqual(initialCalcState);
  });
});

describe("clear", () => {
  it("resets to the initial state from mid-calculation", () => {
    const state = run(["5", "×", "3", "C"]);
    expect(state).toEqual(initialCalcState);
  });
});

describe("re-choosing an operator without entering a new digit", () => {
  it("swaps the pending operator instead of applying it twice", () => {
    // 5, +, then change your mind to ×, then 3 = should be 5×3=15, not
    // some double-application artifact of pressing + first.
    const state = run(["5", "+", "×", "3", "="]);
    expect(state.display).toBe("15");
  });
});
