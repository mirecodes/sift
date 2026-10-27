// Push delivery through Firebase Cloud Messaging HTTP v1 (Phase 6, docs/guides/MOBILE_SETUP.md §Push).
// Off until the FCM_SERVICE_ACCOUNT secret is set. The server core already applied the focus rule
// (no push while the user has a running session) and the user's category settings.
import type postgres from 'npm:postgres@3.4.5';

type Sql = ReturnType<typeof postgres>;
const SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT');

let cached: { token: string; until: number } | null = null;

const b64url = (data: Uint8Array | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** OAuth access token for FCM from the service account (JWT bearer grant, RS256). */
async function accessToken(account: { client_email: string; private_key: string }): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${b64url(signature)}`,
  });
  const body = await res.json();
  cached = { token: body.access_token, until: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

export async function sendPush(sql: Sql, userId: string, message: { category: string; title: string; body: string; url?: string }): Promise<void> {
  if (!SERVICE_ACCOUNT) return;
  const account = JSON.parse(SERVICE_ACCOUNT);
  const devices = await sql`select data from public.devices where user_id = ${userId}`;
  const token = await accessToken(account);
  for (const { data } of devices) {
    const d = data as { pushToken: string | null; categories: Record<string, boolean> };
    if (!d.pushToken || d.categories[message.category] === false) continue;
    await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token: d.pushToken, notification: { title: message.title, body: message.body }, data: { url: message.url ?? '', category: message.category } } }),
    });
  }
}
