// Vercel serverless function — proxies SMS sends to Twilio
// Keeps Twilio credentials server-side on each request (passed from the app's smsConfig)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accountSid, authToken, fromPhone, to, body } = req.body || {};

  if (!accountSid || !authToken || !fromPhone || !to || !body) {
    return res.status(400).json({ error: "Missing required fields: accountSid, authToken, fromPhone, to, body" });
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
        body: new URLSearchParams({
          From: formattedFrom,
          To: formattedTo,
          Body: body,
        }).toString(),
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
