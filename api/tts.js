// Server-side proxy for ElevenLabs text-to-speech.
// Keeps the API key server-side (process.env.ELEVENLABS_API_KEY) so it is never
// shipped to the browser. A user may still supply their own key in the request
// body (their own key, not a shared secret); otherwise the server key is used.
// Verifies the request carries a valid Supabase session token (a signed-in user), to block
// anonymous abuse of this relay (TTS costs money). Uses SUPABASE_URL + SUPABASE_ANON_KEY.
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

  const { text, voiceId, apiKey } = req.body || {};
  // Accept the correctly-spelled name or the common misspelling without the "S".
  const resolvedKey = apiKey || process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY || "";
  if (!resolvedKey) return res.status(400).json({ error: "No ElevenLabs API key configured. Set ELEVENLABS_API_KEY on the server or save your own key in settings." });
  if (!text || !voiceId) return res.status(400).json({ error: "Missing text or voiceId" });

  try {
    const elRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId), {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": resolvedKey,
      },
      body: JSON.stringify({
        text: String(text).substring(0, 600),
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    });

    if (!elRes.ok) {
      const errBody = await elRes.text().catch(() => "");
      // Forward the upstream status so the client's 401/422/429 hints still work.
      return res.status(elRes.status).json({ error: "ElevenLabs " + elRes.status + (errBody ? " (" + errBody.substring(0, 120) + ")" : "") });
    }

    const audio = Buffer.from(await elRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    return res.status(200).send(audio);
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
