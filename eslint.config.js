import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // This is the rule that would have caught today's genFrequency bug
      // instantly, before it ever reached deployment — a variable used
      // in JSX or a function body that was never declared anywhere.
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Genuine correctness rule — hooks called conditionally or out of
      // order is a real bug class, not a style preference.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off", // not needed with the new JSX transform
      "react/react-in-jsx-scope": "off",
      // Deliberately NOT enabling the newer react-hooks "compiler-era"
      // rules (set-state-in-effect, use-memo, immutability, purity,
      // etc.) — they're tuned for React 19's compiler and flag this
      // codebase's existing, working, intentional fetch-on-mount pattern
      // as an error. Rewriting deployed code to satisfy them would be
      // real risk for a stylistic/future-compatibility concern, not the
      // kind of bug this config exists to catch.
    },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
