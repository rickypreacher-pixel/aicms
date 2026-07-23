// Vercel serverless function — proxies SMS sends to Twilio.
// Credentials are read from the SERVER environment (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM_NUMBER) so the auth token is never held in the browser. For backward
// compatibility, values in the request body are used only if the env vars are absent.
// Verifies the request carries a valid Supabase session token (a signed-in user), to block
// anonymous abuse of this relay (SMS costs money per message). Uses SUPABASE_URL +
// SUPABASE_ANON_KEY (both public) env vars.
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await getAuthedUser(req))) {
    return res.status(401).json({ error: "Unauthorized. Please sign in to the app and try again." });
  }

  const b = req.body || {};
  const accountSid = process.env.TWILIO_ACCOUNT_SID || b.accountSid;
  const authToken = process.env.TWILIO_AUTH_TOKEN || b.authToken;
  const fromPhone = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_FROM || b.fromPhone;
  const { to, body, mediaUrl } = b;

  if (!accountSid || !authToken || !fromPhone) {
    return res.status(400).json({ error: "SMS not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in your Vercel environment variables." });
  }
  if (!to || !body) {
    return res.status(400).json({ error: "Missing required fields: to, body" });
  }

  // Validate phone number format
  const cleanTo = to.replace(/\D/g, "");
  if (cleanTo.length < 10) {
    return res.status(400).json({ error: "Invalid phone number — must have at least 10 digits" });
  }
  const formattedTo = cleanTo.startsWith("1") ? "+" + cleanTo : "+1" + cleanTo;
  const cleanFrom = fromPhone.replace(/\D/g, "");
  const formattedFrom = fromPhone.startsWith("+") ? fromPhone : "+1" + cleanFrom;

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: (() => {
          const params = new URLSearchParams({ From: formattedFrom, To: formattedTo, Body: body });
          // MMS: attach one or more public image URLs. Adding MediaUrl turns the message into an MMS
          // (Twilio bills MMS at a higher rate than SMS, and the From number must be MMS-capable).
          const medias = Array.isArray(mediaUrl) ? mediaUrl : (mediaUrl ? [mediaUrl] : []);
          medias.slice(0, 10).forEach((u) => { if (u) params.append("MediaUrl", String(u)); });
          return params.toString();
        })(),
      }
    );

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      // Return Twilio's full error message and code for diagnosis
      return res.status(400).json({
        error: data.message || "Twilio error",
        code: data.code,
        moreInfo: data.more_info || "",
        status: twilioRes.status,
      });
    }

    return res.status(200).json({ success: true, sid: data.sid, messageStatus: data.status, to: formattedTo, from: formattedFrom });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Twilio: " + err.message });
  }
}
