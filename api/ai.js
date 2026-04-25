export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, system, apiKey } = req.body || {};

  if (!apiKey) {
    return res.status(400).json({ error: "No API key provided" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: system || "You are NTCC AI, a helpful church assistant for Pastor Hall.",
        messages: messages || [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Anthropic API error", status: response.status });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
