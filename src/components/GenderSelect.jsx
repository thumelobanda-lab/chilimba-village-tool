import React from "react";

// Shared option list for the "how should we address you" field —
// Login.jsx (sign-up), CreateGroup.jsx, and AddGroupModal.jsx each embed
// this same select, so keeping the list here means adding/renaming a
// title only happens in one place. Values must match normalizeGender()
// in worker/src/auth.js / src/lib/api/auth.js — "male"/"female" are the
// original two (kept as-is so existing accounts need no migration).
export const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Sister" },
  { value: "male", label: "Brother" },
  { value: "mrs", label: "Mrs" },
  { value: "mr", label: "Mr" },
  { value: "ms", label: "Ms" },
  { value: "dr", label: "Dr" },
  { value: "father", label: "Father" },
  { value: "madame", label: "Madame" },
];

export default function GenderSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}>
      {GENDER_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
