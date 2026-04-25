export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, system, apiKey } = req.body || {};
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
  if (!resolvedKey) return res.status(400).json({ error: "No API key provided" });
  if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });

  // Fetch available models from Anthropic to pick the right one dynamically
  let model = "claude-opus-4-5";
  try {
    const modelsRes = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" }
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const ids = (modelsData.data || []).map(m => m.id);
      // prefer newest sonnet or haiku available
      const preferred = [
        "claude-opus-4-5","claude-opus-4-0","claude-sonnet-4-5","claude-sonnet-4-0",
        "claude-3-7-sonnet-20250219","claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022","claude-3-haiku-20240307"
      ];
      for (const m of preferred) {
        if (ids.includes(m)) { model = m; break; }
      }
      if (!ids.includes(model)) model = ids[0] || model;
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
