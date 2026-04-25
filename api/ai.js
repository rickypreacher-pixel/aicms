export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, system, apiKey } = req.body || {};
  // Use key from client (localStorage) OR server environment variable
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
  if (!resolvedKey) return res.status(400).json({ error: "No API key provided" });
  if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": resolvedKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1024,
        system: system || "You are NTCC AI, a helpful church assistant for Pastor Hall.",
        messages,
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: "Non-JSON response from Anthropic: " + text.substring(0,200) }); }

    if (!response.ok) {
      const detail = JSON.stringify(data?.error || data);
      return res.status(response.status).json({ error: "Anthropic " + response.status + ": " + detail });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
