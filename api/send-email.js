// Vercel serverless function — sends email via Resend (https://resend.com).
// The API key stays server-side in RESEND_API_KEY and is never shipped to the browser.
// The sender must be a Resend-verified address: set RESEND_FROM to your verified sender
// (e.g. "noreply@yourchurch.org"); it falls back to Resend's onboarding sender for testing.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "Email not configured. Add RESEND_API_KEY in your Vercel environment variables." });
  }

  const { to, subject, html, text, cc, bcc, fromName, replyTo } = req.body || {};
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
