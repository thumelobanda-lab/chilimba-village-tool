import React, { useState } from "react";

/**
 * A slim, fixed-height photo banner directly under the header on the
 * Dashboard only — group name plus the cycle-progress line that used to
 * sit loose above "Manage" (see Dashboard.jsx's dashboard-strip). Purely
 * identity/orientation, never the visual focus: the payment ring and
 * "Nothing owed right now" right below it still are. No animation, no
 * dependency on the photo actually loading — see handleError below.
 *
 * @param {{ groupName: string, cycleLine: string|null }} props
 */
export default function DashboardCoverBanner({ groupName, cycleLine }) {
  // A failed image load falls back to a solid deep-green panel (same
  // family as the overlay gradient) rather than a broken-image icon —
  // the overlay/text stay identical either way, only the photo drops
  // out, so nothing about the banner's layout or legibility depends on
  // the network request succeeding.
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={"dashboard-cover-banner" + (imgFailed ? " dashboard-cover-banner-fallback" : "")}>
      {!imgFailed && (
        <img
          className="dashboard-cover-banner-img"
          src="/images/cover-victoria-falls.webp"
          width={960}
          height={300}
          loading="eager"
          alt="Victoria Falls at low sun"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="dashboard-cover-banner-overlay">
        <span className="dashboard-cover-banner-name">{groupName}</span>
        {cycleLine && <span className="dashboard-cover-banner-cycle">{cycleLine}</span>}
      </div>
    </div>
  );
}
