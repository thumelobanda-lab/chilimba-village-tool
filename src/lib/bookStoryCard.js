/**
 * Draws "Your Book's Story" onto a canvas — the downloadable/shareable
 * image, same "plain draw, not React state" approach as
 * inviteCard.js's drawCard and Receipt.jsx's drawReceipt (this only
 * needs to render once per open, not stay interactive). Square format,
 * matching InviteCard's own choice, since that's what shares cleanly
 * into a WhatsApp chat or status.
 *
 * Colors are hardcoded to mirror the app's Deep Onyx/gold palette
 * (styles.css's --panel/--bg/--accent-2) — a canvas 2D context can't
 * read CSS custom properties.
 */

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

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
  return lineY;
}

export function drawBookStoryCard(canvas, stats) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  // Background — onyx gradient, same stops as the app header.
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0E262D");
  bg.addColorStop(1, "#07191E");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Gold accent stripes, top and bottom — echoes InviteCard/Receipt.
  ctx.fillStyle = "#D4A94A";
  ctx.fillRect(0, 0, w, 14);
  ctx.fillRect(0, h - 14, w, 14);

  ctx.textAlign = "center";

  // Brand + title
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText("OPENBOOK", w / 2, 100);

  // A simple open-book glyph, hand-drawn rather than an emoji fillText —
  // canvas text rendering falls back to inconsistent (sometimes missing)
  // glyphs for pictographic emoji depending on the OS's installed font
  // stack, which is a real risk for an image meant to be downloaded/
  // shared outside the app. Two curved "pages" meeting at a spine,
  // mirroring OpenBookMark.jsx's line-art shape at a much larger size.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bookY = 220, bookHalfWidth = 90, bookHeight = 70;
  ctx.beginPath();
  ctx.moveTo(w / 2, bookY);
  ctx.quadraticCurveTo(w / 2 - bookHalfWidth, bookY - bookHeight * 0.4, w / 2 - bookHalfWidth, bookY + bookHeight);
  ctx.quadraticCurveTo(w / 2 - bookHalfWidth * 0.4, bookY + bookHeight * 0.7, w / 2, bookY + bookHeight * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2, bookY);
  ctx.quadraticCurveTo(w / 2 + bookHalfWidth, bookY - bookHeight * 0.4, w / 2 + bookHalfWidth, bookY + bookHeight);
  ctx.quadraticCurveTo(w / 2 + bookHalfWidth * 0.4, bookY + bookHeight * 0.7, w / 2, bookY + bookHeight * 0.85);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 54px system-ui, sans-serif";
  ctx.fillText("Your Book's Story", w / 2, 350);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 34px system-ui, sans-serif";
  wrapText(ctx, stats.groupName || "", w / 2, 410, w - 160, 40);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText(`${stats.cycleName || ""} · complete`, w / 2, 455);

  // A dark "page" panel holding the four stats — the one place this
  // card explicitly nods at "book" over "generic celebration graphic".
  const panelX = 90, panelY = 510, panelW = w - 180, panelH = 380;
  ctx.fillStyle = "#0E262D";
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 24);
  ctx.fill();

  const stats2x2 = [
    { value: money(stats.totalContributed), label: "Moved through the group" },
    { value: String(stats.totalActiveMembers), label: "Members in the circle" },
    { value: stats.grs?.score != null ? `${stats.grs.score}%` : "—", label: "On-time payment rate" },
    { value: String(stats.longestStreak), label: "Longest payment streak" },
  ];
  const colW = panelW / 2, rowH = panelH / 2;
  stats2x2.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = panelX + colW * col + colW / 2;
    const cy = panelY + rowH * row + rowH / 2;
    ctx.fillStyle = "#D4A94A";
    ctx.font = "700 56px system-ui, sans-serif";
    ctx.fillText(s.value, cx, cy - 4);
    ctx.fillStyle = "#9FB3B8";
    ctx.font = "600 22px system-ui, sans-serif";
    wrapText(ctx, s.label.toUpperCase(), cx, cy + 34, colW - 40, 26);
  });

  // Closing line — gold, the one deliberate "celebration moment" color
  // per the design brief, sitting below the page panel.
  ctx.fillStyle = "#D4A94A";
  ctx.font = "700 36px system-ui, sans-serif";
  wrapText(ctx, stats.closingLine || "", w / 2, panelY + panelH + 70, w - 140, 44);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText("openbook.app", w / 2, h - 50);
}
