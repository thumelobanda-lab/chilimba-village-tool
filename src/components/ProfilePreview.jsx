import React from "react";
import MemberPreviewPopover from "./MemberPreviewPopover.jsx";

/**
 * The header's own small profile badge (top-left, under the OpenBook
 * wordmark) — a thin wrapper around MemberPreviewPopover fixed to the
 * signed-in member's own name/photo with the "Change photo" action
 * enabled (isSelf), since only your own preview offers that.
 *
 * Doesn't fetch its own photo — App.jsx already fetches the signed-in
 * member's own photo once (headerPhotoUrl) for this exact purpose;
 * passed in here and reused at two sizes rather than fetched twice.
 */
export default function ProfilePreview({ session, photoUrl, onChangePhoto }) {
  return (
    <MemberPreviewPopover
      name={session.name}
      photoDataUrl={photoUrl}
      isSelf
      onChangePhoto={onChangePhoto}
      triggerSize={48}
    />
  );
}
