import React, { useEffect, useState } from "react";
import { getProfilePhotoUrl } from "../lib/api.js";

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A member's photo if they have one, otherwise the same initials-circle
 * fallback used elsewhere (PayoutAvatarRow.jsx). `photoDataUrl` lets a
 * caller that already has the data URL in hand (mock mode's roster
 * response) skip the fetch entirely; otherwise, when `hasPhoto` is true,
 * this fetches lazily via getProfilePhotoUrl and cleans up its own blob
 * URL on unmount/name change. Never fetches when hasPhoto is false —
 * calling the photo endpoint for every photo-less member on a roster
 * would be a wasted round trip per member.
 */
export default function Avatar({ name, hasPhoto, photoDataUrl, size = 36 }) {
  const [fetchedUrl, setFetchedUrl] = useState(null);

  useEffect(() => {
    if (photoDataUrl || !hasPhoto) return;
    let cancelled = false;
    let objectUrl = null;
    getProfilePhotoUrl(name).then((url) => {
      if (cancelled) return;
      objectUrl = url;
      setFetchedUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [name, hasPhoto, photoDataUrl]);

  const src = photoDataUrl || fetchedUrl;
  const style = { width: size, height: size };

  if (src) {
    return <img className="avatar-photo" style={style} src={src} alt="" />;
  }
  return (
    <div className="avatar-fallback" style={style} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
