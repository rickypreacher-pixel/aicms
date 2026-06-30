// Verifies the request carries a valid Supabase session token (a signed-in user), to block
// anonymous abuse of this relay (AI tokens cost money). Uses SUPABASE_URL + SUPABASE_ANON_KEY.
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

  const { messages, system, apiKey } = req.body || {};
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
  if (!resolvedKey) return res.status(400).json({ error: "No API key provided" });
  if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });

  // Fetch available models from Anthropic to pick the best one this key can actually use.
  // NOTE: /v1/models may LIST special-access models (e.g. Claude Fable/Mythos) that 404 on /v1/messages
  // for a normal key — never auto-select those; prefer Opus, then Sonnet, then Haiku.
  let model = "claude-opus-4-8";
  const isRestricted = (id) => /fable|mythos/i.test(String(id || ""));
  try {
    const modelsRes = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" }
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const ids = (modelsData.data || []).map(m => m.id).filter(id => !isRestricted(id));
      const preferred = [
        "claude-opus-4-8","claude-opus-4-7","claude-opus-4-6","claude-opus-4-5","claude-opus-4-0",
        "claude-sonnet-4-6","claude-sonnet-4-5","claude-sonnet-4-0",
        "claude-haiku-4-5-20251001","claude-haiku-4-5",
        "claude-3-7-sonnet-20250219","claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022","claude-3-haiku-20240307"
      ];
      let picked = "";
      for (const m of preferred) { if (ids.includes(m)) { picked = m; break; } }
      // Fall back to the first NON-restricted model the key has, else keep the safe default.
      model = picked || ids[0] || model;
    }
  } catch(e) { /* use default */ }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": resolvedKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: system || "You are NTCC AI, a helpful church assistant for Pastor Hall.",
        messages,
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: "Non-JSON from Anthropic: " + text.substring(0,200) }); }

    if (!response.ok) {
      return res.status(response.status).json({ error: "Anthropic " + response.status + " (model:" + model + "): " + JSON.stringify(data?.error || data) });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
