// ---------------------------------------------------------------------------
// Minimal, dependency-free transactional email via Resend's HTTP API.
//
// No npm dependency (keeps package-lock stable for `npm ci`) and fully
// env-gated: if RESEND_API_KEY / EMAIL_FROM are unset, every send is a safe
// no-op that logs and returns { sent: false }. Set those env vars (plus an
// optional OPS_EMAIL for internal alerts) to activate delivery.
// ---------------------------------------------------------------------------

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendResult {
  sent: boolean;
  skipped?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** The internal address that receives ops alerts (falls back to EMAIL_FROM). */
export function opsEmail(): string | null {
  return process.env.OPS_EMAIL || process.env.EMAIL_FROM || null;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log(
      `[email] skipped "${args.subject}" -> ${Array.isArray(args.to) ? args.to.join(", ") : args.to} (RESEND_API_KEY/EMAIL_FROM not set)`,
    );
    return { sent: false, skipped: "email not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] send failed (${res.status}): ${detail}`);
      return { sent: false, error: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err: any) {
    console.error("[email] send error:", err?.message ?? err);
    return { sent: false, error: err?.message ?? "unknown error" };
  }
}

const brandWrap = (inner: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0a141f">
    <div style="background:#0a141f;padding:20px 24px;border-radius:12px 12px 0 0">
      <span style="color:#fff;font-weight:700;font-size:18px;letter-spacing:.5px">MSP Pentesting</span>
    </div>
    <div style="border:1px solid #e5e9ef;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      ${inner}
    </div>
  </div>`;

/** Confirmation to the customer that their manual engagement purchase landed. */
export function manualOrderCustomerEmail(opts: {
  packageLabel: string;
  amountCents: number;
}): { subject: string; html: string } {
  const amount = `$${(opts.amountCents / 100).toLocaleString()}`;
  return {
    subject: "Your MSP Pentesting engagement is confirmed",
    html: brandWrap(`
      <h2 style="margin:0 0 12px;font-size:18px">Payment received — thank you!</h2>
      <p style="margin:0 0 12px;line-height:1.5">
        We've received your payment of <strong>${amount}</strong> for
        <strong>${opts.packageLabel}</strong>.
      </p>
      <p style="margin:0 0 12px;line-height:1.5">
        Next step: tell us what to test. Please complete your scoping details
        (targets, contacts, environment) so our team can kick off your
        engagement. You'll be prompted right after this — or reply to this email
        and we'll help.
      </p>
      <p style="margin:16px 0 0;color:#5a6b7b;font-size:13px">
        — The MSP Pentesting team
      </p>`),
  };
}

/** Internal alert so the team knows a paid engagement needs scoping/kickoff. */
export function manualOrderOpsEmail(opts: {
  customerEmail: string;
  packageLabel: string;
  amountCents: number;
  requestId: string;
}): { subject: string; html: string } {
  const amount = `$${(opts.amountCents / 100).toLocaleString()}`;
  return {
    subject: `💰 Paid manual order: ${opts.packageLabel} (${amount})`,
    html: brandWrap(`
      <h2 style="margin:0 0 12px;font-size:18px">New paid manual engagement</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 0;color:#5a6b7b">Customer</td><td style="padding:4px 0"><strong>${opts.customerEmail}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#5a6b7b">Package</td><td style="padding:4px 0">${opts.packageLabel}</td></tr>
        <tr><td style="padding:4px 0;color:#5a6b7b">Amount</td><td style="padding:4px 0">${amount}</td></tr>
        <tr><td style="padding:4px 0;color:#5a6b7b">Request</td><td style="padding:4px 0">${opts.requestId}</td></tr>
      </table>
      <p style="margin:14px 0 0;line-height:1.5">
        It's in the admin Requests queue with <strong>status: pending</strong> and
        <strong>needsScoping</strong>. Follow up if the customer hasn't submitted scope.
      </p>`),
  };
}
