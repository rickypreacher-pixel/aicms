export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, system, apiKey } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: "No API key provided" });
  if (!messages || messages.length === 0) return res.status(400).json({ error: "No messages provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: system || "You are NTCC AI, a helpful church assistant for Pastor Hall.",
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = JSON.stringify(data?.error || data);
      return res.status(response.status).json({ error: "Anthropic " + response.status + ": " + detail });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
