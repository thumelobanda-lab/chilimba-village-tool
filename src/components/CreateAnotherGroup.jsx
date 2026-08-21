import React, { useState } from "react";
import CreateGroup from "./CreateGroup.jsx";

/**
 * Admin-only in-app path to starting a brand-new, unrelated Chilimba
 * group — the pre-login "Create a group" button is gone (see Login.jsx);
 * this is the only way left to create one. Reuses CreateGroup.jsx's form
 * unchanged, but wraps it with a confirmation screen instead of
 * switching the admin into the new group's session: they stay signed in
 * to whatever group they were already in, and get the new group's code
 * to hand off to whoever's actually going to use it.
 */
export default function CreateAnotherGroup({ onCreate }) {
  const [created, setCreated] = useState(null); // { groupName, groupSlug } | null

  const handleCreate = async (fields) => {
    const result = await onCreate(fields);
    setCreated({ groupName: result.groupName, groupSlug: result.groupSlug });
  };

  if (created) {
    return (
      <div className="panel">
        <h2 className="panel-title">Group created</h2>
        <p className="muted small">
          "{created.groupName}" is ready, with its own separate admin account — you're
          still signed in here, in your current group. Share the code below with whoever's
          running that group so they can sign in.
        </p>
        <table className="summary-table">
          <tbody>
            <tr><td>Group code</td><td className="ar">{created.groupSlug}</td></tr>
          </tbody>
        </table>
        <button className="btn-ghost-dark" style={{ marginTop: 12 }} onClick={() => setCreated(null)}>
          Create another
        </button>
      </div>
    );
  }

  return <CreateGroup onCreate={handleCreate} />;
}
