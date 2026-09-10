import { requireSession } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

const MAX_LENGTH = 5000;

// A member's own private scratchpad — always the signed-in session's own
// `users` row, never a name/id passed in from the client, so there's no
// way to read or write anyone else's notes.
export default function registerNotepadRoutes(router) {
  router.get("/api/notepad", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    const row = await env.DB.prepare(`SELECT notepad_text FROM users WHERE id = ?`).bind(session.id).first();
    return json({ text: row?.notepad_text || "" }, 200, cors);
  });

  router.put("/api/notepad", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    const { text } = await request.json();
    if (typeof text !== "string") throw new HttpError(400, "text is required.");
    if (text.length > MAX_LENGTH) throw new HttpError(400, `Keep notes under ${MAX_LENGTH.toLocaleString()} characters.`);

    await env.DB.prepare(`UPDATE users SET notepad_text = ? WHERE id = ?`).bind(text, session.id).run();
    return json({ ok: true }, 200, cors);
  });
}
