/**
 * Source of truth for the Supabase auth emails (templates and subjects).
 *
 * Supabase stores each email as one full HTML string and has no shared
 * layouts, so the shared frame and blocks live here and every email is
 * built from them.
 *
 * Usage:
 *   npx tsx scripts/email-templates.ts              compare with live Supabase
 *   npx tsx scripts/email-templates.ts --out <dir>  write the HTML to preview
 *   npx tsx scripts/email-templates.ts --push       update the ones that differ
 *
 * After --push, Supabase's auth server keeps sending the old templates for
 * roughly 10 minutes (seen 2026-11-18: still old 2 minutes after its config
 * reload, new 12 minutes after). Wait before sending a test email.
 *
 * Reads SUPABASE_URL from .env for the project ref. The Management API token
 * comes from SUPABASE_ACCESS_TOKEN, or from the Supabase CLI's macOS keychain
 * entry after `supabase login`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

try {
  process.loadEnvFile?.();
} catch {
  // Fall back to the shell environment.
}

const SITE = "https://trophyrooms.org";
const SUPPORT = "support@trophyrooms.org";
// The site header logo (trophy-rooms-web/public/logo.png). Gmail's image proxy caches
// by URL, so a new banner needs a new URL (or a ?v= suffix) to show up.
const BANNER = `${SITE}/logo.png`;
const MONO = "'SF Mono',Menlo,Consolas,monospace";

const layout = (rows: string[]) => `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;padding:40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td align="center" style="padding-bottom:24px;">
        <img src="${BANNER}" alt="Trophy Rooms" width="280" style="display:block;max-width:280px;width:100%;height:auto;" />
      </td></tr>
${rows.join("\n")}
      <tr><td style="border-top:1px solid #e4e4e7;padding-top:20px;" align="center">
        <span style="font-size:12px;color:#a1a1aa;">
          Trophy Rooms &middot; Track your games, trophies, and collection<br/>
          <a href="${SITE}" style="color:#dc143c;text-decoration:none;">trophyrooms.org</a> &middot;
          <a href="mailto:${SUPPORT}" style="color:#dc143c;text-decoration:none;">${SUPPORT}</a>
        </span>
      </td></tr>
    </table>
  </td></tr>
</table>
`;

const row = (paddingBottom: number, inner: string) =>
  `      <tr><td align="center" style="padding-bottom:${paddingBottom}px;">\n${inner}\n      </td></tr>`;

const title = (text: string) =>
  row(8, `        <span style="font-size:22px;font-weight:700;color:#18181b;">${text}</span>`);

const intro = (text: string) =>
  row(28, `        <span style="font-size:15px;line-height:22px;color:#52525b;">${text}</span>`);

const note = (text: string) => row(28, `        <span style="font-size:13px;color:#a1a1aa;">${text}</span>`);

const codeBox = row(
  28,
  `        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background-color:#f4f4f5;border-radius:12px;padding:16px 28px;">
            <span style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:10px;color:#dc143c;">{{ .Token }}</span>
          </td>
        </tr></table>`
);

const button = (label: string) =>
  row(
    20,
    `        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#dc143c;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:999px;">${label}</a>`
  );

const altCode = row(
  28,
  `        <span style="font-size:13px;color:#a1a1aa;">Or enter this code if you were asked for one:&nbsp;
          <span style="font-family:${MONO};font-weight:700;color:#52525b;letter-spacing:2px;">{{ .Token }}</span>
        </span>`
);

const notMeWarning = row(
  28,
  `        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="background-color:#fef2f2;border-radius:12px;padding:14px 18px;" align="center">
            <span style="font-size:13px;line-height:19px;color:#b91c1c;">Didn't do this? Reset your password immediately and contact <a href="mailto:${SUPPORT}" style="color:#b91c1c;font-weight:600;">${SUPPORT}</a> &mdash; someone may have access to your account.</span>
          </td>
        </tr></table>`
);

const notMe = "No further action is needed if this was you.";

// Keys are Supabase's template names: mailer_templates_<key>_content and mailer_subjects_<key>.
const EMAILS: Record<string, { subject: string; rows: string[] }> = {
  confirmation: {
    subject: "Your Trophy Rooms verification code",
    rows: [
      title("Verify your email"),
      intro("Welcome to Trophy Rooms! Enter this code in the app to finish creating your account."),
      codeBox,
      note("This code expires in 1 hour. If you didn't create a Trophy Rooms account, you can safely ignore this email."),
    ],
  },
  reauthentication: {
    subject: "Your Trophy Rooms confirmation code",
    rows: [
      title("Confirm it's you"),
      intro("You're about to make a sensitive change to your Trophy Rooms account. Enter this code to confirm it's really you."),
      codeBox,
      note("If you didn't try to change anything, please reset your password immediately &mdash; someone may have access to your account."),
    ],
  },
  magic_link: {
    subject: "Your Trophy Rooms sign-in link",
    rows: [
      title("Your sign-in link"),
      intro("Tap the button below to sign in to Trophy Rooms. No password needed."),
      button("Sign In to Trophy Rooms"),
      altCode,
      note("This link expires in 1 hour and can only be used once. If you didn't request it, you can safely ignore this email."),
    ],
  },
  recovery: {
    subject: "Reset your Trophy Rooms password",
    rows: [
      title("Reset your password"),
      intro("Someone requested a password reset for this account. If it was you, tap the button below to choose a new password."),
      button("Reset Password"),
      altCode,
      note("This link expires in 1 hour. If you didn't request a reset, your password is safe and you can ignore this email."),
    ],
  },
  email_change: {
    subject: "Confirm your new Trophy Rooms email",
    rows: [
      title("Confirm your new email"),
      intro('You asked to change your Trophy Rooms email to <strong style="color:#18181b;">{{ .NewEmail }}</strong>. Confirm the change below.'),
      button("Confirm New Email"),
      altCode,
      note("If you didn't request this change, please reset your password immediately &mdash; someone may have access to your account."),
    ],
  },
  invite: {
    subject: "You're invited to Trophy Rooms",
    rows: [
      title("You're invited to Trophy Rooms"),
      intro("You've been invited to join Trophy Rooms &mdash; track your games, trophies, and physical collection across every platform."),
      button("Accept Invitation"),
      note("This invitation was sent to {{ .Email }}. If you weren't expecting it, you can safely ignore this email."),
    ],
  },
  password_changed_notification: {
    subject: "Your Trophy Rooms password was changed",
    rows: [
      title("Your password was changed"),
      intro(`The password for your Trophy Rooms account ({{ .Email }}) was just changed. ${notMe}`),
      notMeWarning,
    ],
  },
  email_changed_notification: {
    subject: "Your Trophy Rooms email was changed",
    rows: [
      title("Your email address was changed"),
      intro(`The email address on your Trophy Rooms account was just changed. ${notMe}`),
      notMeWarning,
    ],
  },
  identity_linked_notification: {
    subject: "A new sign-in method was added to Trophy Rooms",
    rows: [
      title("New sign-in method added"),
      intro(`A new way to sign in was just linked to your Trophy Rooms account ({{ .Email }}). ${notMe}`),
      notMeWarning,
    ],
  },
  identity_unlinked_notification: {
    subject: "A sign-in method was removed from Trophy Rooms",
    rows: [
      title("Sign-in method removed"),
      intro(`A sign-in method was just removed from your Trophy Rooms account ({{ .Email }}). ${notMe}`),
      notMeWarning,
    ],
  },
};

function accessToken(): string {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const stored = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], {
    encoding: "utf8",
  }).trim();
  const prefix = "go-keyring-base64:";
  return stored.startsWith(prefix) ? Buffer.from(stored.slice(prefix.length), "base64").toString() : stored;
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const built = Object.entries(EMAILS).map(([key, { subject, rows }]) => ({ key, subject, html: layout(rows) }));

  if (outIndex !== -1) {
    const dir = args[outIndex + 1];
    if (!dir) throw new Error("--out needs a directory");
    mkdirSync(dir, { recursive: true });
    for (const { key, html } of built) writeFileSync(join(dir, `${key}.html`), html);
    console.log(`wrote ${built.length} files to ${dir}`);
    return;
  }

  const ref = new URL(process.env.SUPABASE_URL ?? "").hostname.split(".")[0];
  const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" };

  const res = await fetch(api, { headers });
  if (!res.ok) throw new Error(`GET auth config failed: ${res.status} ${await res.text()}`);
  const live = (await res.json()) as Record<string, unknown>;

  const changes: Record<string, string> = {};
  for (const { key, subject, html } of built) {
    const contentKey = `mailer_templates_${key}_content`;
    const subjectKey = `mailer_subjects_${key}`;
    // Supabase trims trailing whitespace, so compare trimmed.
    const contentChanged = String(live[contentKey] ?? "").trim() !== html.trim();
    const subjectChanged = live[subjectKey] !== subject;
    if (contentChanged) changes[contentKey] = html;
    if (subjectChanged) changes[subjectKey] = subject;
    const status = [contentChanged && "template", subjectChanged && "subject"].filter(Boolean).join(" + ");
    console.log(`${status ? "differs" : "same   "}  ${key}${status ? ` (${status})` : ""}`);
  }

  if (!args.includes("--push")) {
    if (Object.keys(changes).length) console.log("\nRun with --push to update Supabase.");
    return;
  }
  if (!Object.keys(changes).length) return console.log("\nNothing to push.");

  const patch = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(changes) });
  if (!patch.ok) throw new Error(`PATCH auth config failed: ${patch.status} ${await patch.text()}`);
  console.log(`\nPushed ${Object.keys(changes).length} field(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
