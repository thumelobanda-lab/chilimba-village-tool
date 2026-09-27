// The group name can change any time (GroupSetup's "Group name" field
// saves straight into `config` via useGroupConfig), but `session.groupName`
// is only a snapshot taken at the last login/join/switch and has no
// reason to update just because someone renamed the group they're already
// signed into. Anything showing "the group's name" live — the dashboard
// banner, the group switcher's own trigger label — must read `config`
// first so a rename shows up immediately, everywhere, with no reload.
// `session` is kept only as a fallback for the brief window before
// config's first fetch resolves (or if it never loads at all).
export function resolveGroupName(config, session) {
  return config?.groupName || session?.groupName || "";
}
