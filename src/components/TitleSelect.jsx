import React from "react";

// Shared option list for the "how should we address you" field — Login.jsx
// (sign-up), CreateGroup.jsx, AddGroupModal.jsx, and Profile.jsx each embed
// this same select, so adding/renaming a title only happens in one place.
// This is purely a form of address (used only by dashboardMath.js's
// titledAddress()) — it is NOT gender. Values must match normalizeTitle()
// in worker/src/auth.js / src/lib/api/auth.js.
export const TITLE_OPTIONS = [
  { value: "", label: "No title" },
  { value: "sister", label: "Sister" },
  { value: "brother", label: "Brother" },
  { value: "mrs", label: "Mrs" },
  { value: "mr", label: "Mr" },
  { value: "ms", label: "Ms" },
  { value: "dr", label: "Dr" },
  { value: "father", label: "Father" },
  { value: "madame", label: "Madame" },
];

// The dropdown above is a closed set, so the backend should never
// actually reject a value it sent — this only matters as a defense-in-
// depth backstop (e.g. a stale frontend talking to a newer/older
// backend). When it does happen, the raw validation text names a
// backend column ("Title must be one of: ...") the member never saw
// labeled that way, so callers should catch it and show this short,
// field-level message beside the select instead of surfacing it in a
// generic top-of-form error banner.
export function isTitleError(e) {
  return !!e?.message && /^title must be/i.test(e.message);
}
export const TITLE_FIELD_ERROR = "Choose an option from the list.";

export default function TitleSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}>
      {TITLE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
