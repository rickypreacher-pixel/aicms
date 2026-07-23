// Vercel serverless function — sends email via Resend (https://resend.com).
// The API key stays server-side in RESEND_API_KEY and is never shipped to the browser.
// The sender must be a Resend-verified address: set RESEND_FROM to your verified sender
// (e.g. "noreply@yourchurch.org"); it falls back to Resend's onboarding sender for testing.
// Verifies the request carries a valid Supabase session token (a signed-in user), to block
// anonymous abuse of this relay. Uses SUPABASE_URL + SUPABASE_ANON_KEY (both public) env vars.
async function getAuthedUser(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", { headers: { Authorization: "Bearer " + token, apikey: anon } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await getAuthedUser(req))) return res.status(401).json({ error: "Unauthorized. Please sign in to the app and try again." });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "Email not configured. Add RESEND_API_KEY in your Vercel environment variables." });
  }

  const { to, subject, html, text, cc, bcc, fromName, replyTo, attachments } = req.body || {};
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: "Missing required fields: to, subject, and html or text." });
  }

  const fromAddr = process.env.RESEND_FROM || "onboarding@resend.dev";
  const from = fromName ? `${fromName} <${fromAddr}>` : fromAddr;

  try {
    const payload = { from, to: Array.isArray(to) ? to : [to], subject: String(subject) };
    if (html) payload.html = String(html);
    if (text) payload.text = String(text);
    if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
    if (replyTo) payload.reply_to = replyTo;
    // Photo attachments: each item is { filename, path } (a public Storage URL Resend fetches) or
    // { filename, content } (base64). Kept out of the synced blob — only passed in this send request.
    if (Array.isArray(attachments) && attachments.length) {
      const atts = attachments.slice(0, 5).map((a) => {
        if (!a) return null;
        if (a.path) return { filename: String(a.filename || "photo.jpg"), path: String(a.path) };
        if (a.content) return { filename: String(a.filename || "photo.jpg"), content: String(a.content) };
        return null;
      }).filter(Boolean);
      if (atts.length) payload.attachments = atts;
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || data.name || "Resend error", details: data });
    }
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Resend: " + (err && err.message ? err.message : String(err)) });
  }
}
