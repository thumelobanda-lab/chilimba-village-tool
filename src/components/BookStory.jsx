import React, { useEffect, useRef, useState } from "react";
import { money } from "./LedgerTable.jsx";
import { useCountUp } from "../hooks/useCountUp.js";
import { drawBookStoryCard } from "../lib/bookStoryCard.js";
import { buildWhatsAppShareUrl } from "../lib/inviteCard.js";
import Icon from "./Icon.jsx";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

/**
 * "Your Book's Story" — the celebratory recap shown when a full payout
 * rotation completes (see bookStory.js for the stats/tone logic this
 * renders). Two halves, deliberately: the DOM half above is the
 * in-app, animated "moment" (count-up figures, a staggered reveal) —
 * canvas can't do that smoothly without redrawing every frame, and this
 * app already has useCountUp for exactly this. The canvas below is
 * static (drawn once, from the same final `stats`) purely so there's a
 * real image to download/share — same split InviteCard.jsx and
 * Receipt.jsx already use for their own shareable cards.
 */
export default function BookStory({ stats, onClose }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("");
  const [revealed, setRevealed] = useState(false);

  const totalDisplay = useCountUp(stats.totalContributed);
  const membersDisplay = useCountUp(stats.totalActiveMembers, 600);
  const grsDisplay = useCountUp(stats.grs?.score ?? 0, 900);
  const streakDisplay = useCountUp(stats.longestStreak, 700);

  useEffect(() => {
    // One frame after mount so the CSS stagger transition (see
    // .book-story-stat's transition + nth-child delays in styles.css)
    // has a "before" state to animate from, same pattern ProgressRing.jsx
    // uses for its own reveal.
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (canvasRef.current) drawBookStoryCard(canvasRef.current, stats);
  }, [stats]);

  const getBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob((blob) => resolve(blob), "image/png"));

  const filename = () =>
    `book-story-${(stats.groupName || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  const shareMessage = () =>
    `${stats.groupName}'s Book's Story\n\n${stats.closingLine}\n\n` +
    `${money(stats.totalContributed)} moved through the group\n` +
    `${stats.totalActiveMembers} members\n` +
    `${stats.grs?.score != null ? `${stats.grs.score}% on-time rate\n` : ""}` +
    `Longest streak: ${stats.longestStreak} in a row`;

  const download = async () => {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    setStatus("");
    const blob = await getBlob();
    const file = new File([blob], filename(), { type: "image/png" });
    const message = shareMessage();

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message, title: "Your Book's Story" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    await download();
    setStatus("Your browser can't share images directly — the image downloaded instead. Attach it to WhatsApp yourself.");
  };

  const whatsappTextUrl = buildWhatsAppShareUrl(shareMessage());

  return (
    <div className="calc-modal-backdrop book-story-backdrop" onClick={onClose}>
      <div className="calc-modal book-story-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span><Icon name="book" size={16} className="icon-inline" /> Your Book's Story</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={"book-story-hero" + (revealed ? " book-story-revealed" : "")}>
          <div className="book-story-group-name">{stats.groupName}</div>
          <div className="book-story-cycle-name">{stats.cycleName} · complete</div>
        </div>

        <div className={"book-story-stats" + (revealed ? " book-story-revealed" : "")}>
          <div className="book-story-stat" style={{ transitionDelay: revealed ? "80ms" : "0ms" }}>
            <div className="book-story-stat-value">{money(totalDisplay)}</div>
            <div className="book-story-stat-label">Moved through the group</div>
          </div>
          <div className="book-story-stat" style={{ transitionDelay: revealed ? "180ms" : "0ms" }}>
            <div className="book-story-stat-value">{Math.round(membersDisplay)}</div>
            <div className="book-story-stat-label">Members in the circle</div>
          </div>
          <div className="book-story-stat" style={{ transitionDelay: revealed ? "280ms" : "0ms" }}>
            <div className="book-story-stat-value">
              {stats.grs?.score != null ? `${Math.round(grsDisplay)}%` : "—"}
            </div>
            <div className="book-story-stat-label">On-time payment rate</div>
          </div>
          <div className="book-story-stat" style={{ transitionDelay: revealed ? "380ms" : "0ms" }}>
            <div className="book-story-stat-value">{Math.round(streakDisplay)}</div>
            <div className="book-story-stat-label">Longest payment streak</div>
          </div>
        </div>

        <p className={"book-story-closing" + (revealed ? " book-story-revealed" : "")}>
          {stats.closingLine}
        </p>

        <div className="book-story-share">
          <canvas ref={canvasRef} width={CARD_WIDTH} height={CARD_HEIGHT} className="book-story-canvas" />
          <div className="invite-card-actions">
            <button className="btn-primary" style={{ width: "auto" }} onClick={share}>
              <Icon name="share" size={16} className="icon-inline" /> Share Your Book's Story
            </button>
            <button className="btn-ghost-dark" onClick={download}>Download image</button>
            <a className="btn-ghost-dark" href={whatsappTextUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="message" size={16} className="icon-inline" /> Text-only WhatsApp link
            </a>
          </div>
          {status && <p className="muted small" style={{ marginTop: 8 }}>{status}</p>}
        </div>
      </div>
    </div>
  );
}
