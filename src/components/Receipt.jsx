import React, { useEffect, useRef, useState } from "react";
import { buildReceiptData, buildReceiptMessage, buildReceiptFilename } from "../lib/receipt.js";
import { buildWhatsAppShareUrl } from "../lib/inviteCard.js";

const CARD_WIDTH = 900;
const CARD_HEIGHT = 1200; // default/initial height before the first draw computes the real one

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

/**
 * Draws the receipt onto a canvas — same "plain draw, not React state"
 * approach as InviteCard.jsx's drawCard, and the same reason: this only
 * needs to render once per open, not stay interactive.
 *
 * Card height is computed from how many rows are actually shown (a
 * split payment adds two extra rows for the Community Fund / contribution
 * breakdown) rather than a fixed constant, so the reference-number
 * footer never crowds or overlaps the last row — same 330px gap the
 * original fixed 1200px height gave the max 6-row case.
 */
function drawReceipt(canvas, data) {
  const rows = [
    ["Member", data.memberName],
    ["Amount Paid", money(data.amount)],
    ...(data.communityFundAmount > 0
      ? [
          ["→ Community Fund", money(data.communityFundAmount)],
          ["→ Contribution", money(data.contributionAmount)],
        ]
      : []),
    ["For Payout Date", data.dueGroup ? `${data.dueDate} (${data.dueGroup})` : data.dueDate || "—"],
    ...(data.cycleName ? [["Cycle", data.cycleName]] : []),
    ["Date Paid", data.datePaid ? new Date(data.datePaid).toLocaleDateString() : "—"],
    ["Confirmed By", data.confirmedBy || "—"],
  ];

  const w = CARD_WIDTH, h = 600 + 100 * rows.length;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FAF7F0";
  ctx.fillRect(0, 0, w, h);

  // Header band — same deep-green/gold palette as the invite card
  const band = ctx.createLinearGradient(0, 0, w, 0);
  band.addColorStop(0, "#0F4C3A");
  band.addColorStop(1, "#0A3729");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, 190);
  ctx.fillStyle = "#C9962E";
  ctx.fillRect(0, 190, w, 8);

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 46px system-ui, sans-serif";
  ctx.fillText("🧾 Payment Receipt", w / 2, 90);
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(data.groupName, w / 2, 140);

  // Rows: label left, value right, divider beneath (rows computed above,
  // before sizing the canvas)
  let y = 270;
  const left = 60, right = w - 60;
  rows.forEach(([label, value]) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#6E685F";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), left, y);

    ctx.textAlign = "right";
    ctx.fillStyle = "#2A2A28";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText(String(value), right, y + 34);

    ctx.strokeStyle = "#E6DFCF";
    ctx.beginPath();
    ctx.moveTo(left, y + 56);
    ctx.lineTo(right, y + 56);
    ctx.stroke();

    y += 100;
  });

  // Reference number — the single most important thing on the receipt,
  // same visual treatment InviteCard gives the group code
  ctx.textAlign = "center";
  ctx.fillStyle = "#6E685F";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("REFERENCE NUMBER", w / 2, h - 170);
  ctx.fillStyle = "#0F4C3A";
  ctx.font = "700 48px 'IBM Plex Mono', monospace";
  ctx.fillText(data.referenceNumber, w / 2, h - 110);

  ctx.fillStyle = "#3A8B5C";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("✓ Confirmed by an admin", w / 2, h - 55);
}

/**
 * A confirmed payment's receipt — viewable/downloadable in-app, and
 * shareable to WhatsApp with the same image-attach-with-text-fallback
 * pattern as InviteCard.jsx's "Share invite card". Only ever rendered
 * for a confirmed entry (see LedgerTable.jsx / Reconciliation.jsx, which
 * gate the "🧾 Receipt" button on e.confirmedAt) — buildReceiptData
 * throws otherwise, as a defensive backstop.
 */
export default function Receipt({ payment, memberName, groupName, cycleName, scheduleRow, onClose }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("");
  const data = buildReceiptData({ payment, memberName, groupName, cycleName, scheduleRow });

  useEffect(() => {
    if (canvasRef.current) drawReceipt(canvasRef.current, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.referenceNumber]);

  const getBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob((blob) => resolve(blob), "image/png"));

  const download = async () => {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildReceiptFilename(data);
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    setStatus("");
    const blob = await getBlob();
    const file = new File([blob], buildReceiptFilename(data), { type: "image/png" });
    const message = buildReceiptMessage(data);

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message, title: "Payment Receipt" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // user cancelled — not an error
        // fall through to the download fallback below
      }
    }
    await download();
    setStatus("Your browser can't share images directly — the receipt downloaded instead. Attach it to WhatsApp yourself.");
  };

  const whatsappTextUrl = buildWhatsAppShareUrl(buildReceiptMessage(data));

  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Receipt · {data.referenceNumber}</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close receipt">✕</button>
        </div>
        <canvas ref={canvasRef} width={CARD_WIDTH} height={CARD_HEIGHT} className="receipt-card-canvas" />
        <div className="invite-card-actions">
          <button className="btn-primary" style={{ width: "auto" }} onClick={share}>
            📤 Share receipt
          </button>
          <button className="btn-ghost-dark" onClick={download}>Download image</button>
          <a className="btn-ghost-dark" href={whatsappTextUrl} target="_blank" rel="noopener noreferrer">
            💬 Text-only WhatsApp link
          </a>
        </div>
        {status && <p className="muted small" style={{ marginTop: 8 }}>{status}</p>}
      </div>
    </div>
  );
}
