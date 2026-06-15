// Vercel serverless function — receives donation webhooks from Online Giving (onlinegiving.cc)
// and records them into the church's giving inbox. Online Giving does NOT sign its webhooks,
// so the secret in ?key=... authorizes the call: it's looked up to a church_id inside the
// SECURITY DEFINER ingest_online_gift() RPC, which rejects unknown secrets. Uses the public
// SUPABASE_URL + SUPABASE_ANON_KEY env vars (no service-role key needed).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = (req.query && req.query.key) || req.headers["x-webhook-key"] || "";
  if (!key) return res.status(401).json({ error: "Missing key" });

  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(500).json({ error: "Server not configured" });

  let payload = req.body;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { payload = {}; } }
  if (!payload || typeof payload !== "object") payload = {};
  // Diagnostic: log the field NAMES only (no donor values) so we can confirm the payload shape.
  try { console.log("og-webhook keys:", Object.keys(payload).join(",")); } catch {}

  try {
    const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/ingest_online_gift", {
      method: "POST",
      headers: { apikey: anon, Authorization: "Bearer " + anon, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: String(key), p_payload: payload }),
    });
    const text = await r.text();
    if (!r.ok) {
      const unauthorized = /unauthorized/i.test(text);
      return res.status(unauthorized ? 401 : 400).json({ error: unauthorized ? "Unauthorized" : ("Ingest failed: " + text.slice(0, 200)) });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Ingest error: " + (err && err.message ? err.message : String(err)) });
  }
}
