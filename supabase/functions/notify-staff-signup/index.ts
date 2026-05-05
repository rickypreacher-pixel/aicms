// Supabase Edge Function: notify-staff-signup
// Sends welcome SMS to new staff + notifies admin by email and SMS.
//
// Required Supabase secrets (set via Dashboard > Edge Functions > Secrets):
//   TWILIO_ACCOUNT_SID   — from twilio.com console
//   TWILIO_AUTH_TOKEN    — from twilio.com console
//   TWILIO_FROM_PHONE    — your Twilio number e.g. +16025550100
//   RESEND_API_KEY       — from resend.com (free tier available)
//   ADMIN_EMAIL          — admin notification email (default: tca.ricky@aol.com)
//   ADMIN_PHONE          — admin notification phone (default: +16024006890)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_FROM_PHONE  = Deno.env.get('TWILIO_FROM_PHONE') || '';
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL        = Deno.env.get('ADMIN_EMAIL') || 'tca.ricky@aol.com';
const ADMIN_PHONE        = Deno.env.get('ADMIN_PHONE') || '+16024006890';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Normalize a phone number to E.164 format (+1XXXXXXXXXX for US) */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

async function sendSMS(to: string, message: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_PHONE) {
    console.log('Twilio not configured — skipping SMS to', to);
    return;
  }
  const normalized = normalizePhone(to);
  if (!normalized) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({ From: TWILIO_FROM_PHONE, To: normalized, Body: message });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Twilio SMS error:', text);
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('Resend not configured — skipping email to', to);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ChurchOS <notifications@churchos.app>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Resend email error:', text);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { staffName, staffEmail, staffPhone, churchId } = await req.json();

    const tasks: Promise<void>[] = [];

    // 1. Welcome email to staff member
    tasks.push(
      sendEmail(
        staffEmail,
        `Welcome to ChurchOS – Your Staff Account is Ready`,
        `
        <div style="font-family:Arial,sans-serif;max-width:480px;padding:24px">
          <h2 style="color:#1a2e5a;margin-bottom:4px">Welcome to ChurchOS, ${staffName}!</h2>
          <p style="color:#6b7280;margin-top:0">Your staff account has been created successfully.</p>
          <table style="border-collapse:collapse;margin-top:16px;width:100%">
            <tr>
              <td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px;white-space:nowrap">Name</td>
              <td style="padding:8px 0;font-weight:600;color:#1f2937">${staffName}</td>
            </tr>
            <tr>
              <td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px">Email</td>
              <td style="padding:8px 0;color:#1f2937">${staffEmail}</td>
            </tr>
            ${staffPhone ? `<tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px">Phone</td><td style="padding:8px 0;color:#1f2937">${staffPhone}</td></tr>` : ''}
          </table>
          <p style="margin-top:24px;font-size:14px;color:#1f2937">
            You can now sign in to ChurchOS using your email and password. If you need to confirm your email first, click the confirmation link sent by Supabase.
          </p>
          <p style="margin-top:8px;font-size:13px;color:#9ca3af">
            If you did not create this account, please contact your church administrator immediately.
          </p>
        </div>
        `,
      ),
    );

    // 2. Welcome SMS to staff member
    if (staffPhone) {
      tasks.push(
        sendSMS(
          staffPhone,
          `Welcome to ChurchOS, ${staffName}! Your staff account is now active. Sign in at your church app to get started.`,
        ),
      );
    }

    // 3. Admin notification email
    tasks.push(
      sendEmail(
        ADMIN_EMAIL,
        `New Staff Member Joined — ${staffName}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:480px;padding:24px">
          <h2 style="color:#1a2e5a;margin-bottom:4px">New Staff Member Joined</h2>
          <p style="color:#6b7280;margin-top:0">Someone just created a staff account on your ChurchOS.</p>
          <table style="border-collapse:collapse;margin-top:16px;width:100%">
            <tr>
              <td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px;white-space:nowrap">Name</td>
              <td style="padding:8px 0;font-weight:600;color:#1f2937">${staffName}</td>
            </tr>
            <tr>
              <td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px">Email</td>
              <td style="padding:8px 0;color:#1f2937">${staffEmail}</td>
            </tr>
            ${staffPhone ? `<tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-size:13px">Phone</td><td style="padding:8px 0;color:#1f2937">${staffPhone}</td></tr>` : ''}
          </table>
          <p style="margin-top:24px;font-size:13px;color:#9ca3af">
            To manage staff permissions, open ChurchOS and go to <strong>Access Control</strong>.
          </p>
        </div>
        `,
      ),
    );

    // 4. Admin notification SMS
    tasks.push(
      sendSMS(
        ADMIN_PHONE,
        `ChurchOS: New staff member joined — ${staffName} (${staffEmail}). Review in Access Control.`,
      ),
    );

    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-staff-signup error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
