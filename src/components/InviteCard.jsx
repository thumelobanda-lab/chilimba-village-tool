import React, { useEffect, useRef, useState } from "react";
import { buildInviteMessage, buildWhatsAppShareUrl, buildInviteCardFilename, buildCardContent } from "../lib/inviteCard.js";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

/**
 * Draws the invite card onto a canvas. Kept separate from React state so
 * it's a plain, direct draw — the card doesn't need to be interactive,
 * just generated once per group and re-generated if the group's name/
 * code/cycle changes.
 */
function drawCard(canvas, content) {
  const ctx = canvas.getContext("2d");
  const w = CARD_WIDTH, h = CARD_HEIGHT;

  // Background gradient — matches the app's deep-green/gold palette
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#1F4B3F");
  bg.addColorStop(1, "#163a30");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Gold accent stripe, top and bottom — echoes the in-app header
  ctx.fillStyle = "#C99A3D";
  ctx.fillRect(0, 0, w, 14);
  ctx.fillRect(0, h - 14, w, 14);

  ctx.textAlign = "center";

  // Brand
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(content.brand.toUpperCase(), w / 2, 130);

  // Emoji flourish
  ctx.font = "120px system-ui, sans-serif";
  ctx.fillText("🤝", w / 2, 320);

  // Group name — wraps onto a second line if it's long
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 64px system-ui, sans-serif";
  wrapText(ctx, content.groupName, w / 2, 440, w - 160, 74);

  if (content.cycleLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 32px system-ui, sans-serif";
    ctx.fillText(content.cycleLabel, w / 2, 540);
  }

  // Group code — the single most important thing on the card, given
  // maximum visual weight
  ctx.fillStyle = "#C99A3D";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(content.codeLabel, w / 2, 680);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 84px 'IBM Plex Mono', monospace";
  ctx.fillText(content.code, w / 2, 770);

  // Tagline
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "400 30px system-ui, sans-serif";
  wrapText(ctx, content.tagline, w / 2, 880, w - 200, 40);

  // URL
  ctx.fillStyle = "#C99A3D";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(content.url.replace(/^https?:\/\//, ""), w / 2, 990);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      ctx.fillText(line.trim(), x, lineY);
      line = word + " ";
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, lineY);
}

export default function InviteCard({ groupName, groupSlug, cycleName }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("");
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const ready = Boolean(groupName && groupSlug && appUrl);

  useEffect(() => {
    if (!canvasRef.current || !ready) return;
    const content = buildCardContent({ groupName, groupSlug, cycleName, appUrl });
    drawCard(canvasRef.current, content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, groupSlug, cycleName, ready]);

  const getBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob((blob) => resolve(blob), "image/png"));

  const download = async () => {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildInviteCardFilename(groupSlug);
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tries the native share sheet with the image attached (so WhatsApp,
  // if picked, gets the actual card, not just text) — supported on most
  // modern mobile browsers. Falls back to just downloading the image if
  // the browser can't share files, so there's always a working path
  // even on an older phone.
  const share = async () => {
    setStatus("");
    const blob = await getBlob();
    const file = new File([blob], buildInviteCardFilename(groupSlug), { type: "image/png" });
    const message = buildInviteMessage({ groupName, groupSlug, appUrl });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message, title: "Join our Chilimba" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // user cancelled the share sheet — not an error
        // fall through to the download fallback below
      }
    }
    await download();
    setStatus("Your browser can't share images directly — the card downloaded instead. Attach it to WhatsApp yourself.");
  };

  const whatsappTextUrl = ready ? buildWhatsAppShareUrl(buildInviteMessage({ groupName, groupSlug, appUrl })) : "";

  if (!ready) {
    return (
      <div className="invite-card-wrap">
        <p className="muted small">
          Save your group's name in "Group Basics" first — the invite card needs it.
        </p>
      </div>
    );
  }

  return (
    <div className="invite-card-wrap">
      <canvas ref={canvasRef} width={CARD_WIDTH} height={CARD_HEIGHT} className="invite-card-canvas" />
      <div className="invite-card-actions">
        <button className="btn-primary" style={{ width: "auto" }} onClick={share}>
          📤 Share invite card
        </button>
        <button className="btn-ghost-dark" onClick={download}>Download image</button>
        <a className="btn-ghost-dark" href={whatsappTextUrl} target="_blank" rel="noopener noreferrer">
          💬 Text-only WhatsApp link
        </a>
      </div>
      {status && <p className="muted small" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
