// Reads the emails sent by the backend from the Mailpit HTTP API.
export const mailpitUrl = process.env.MAILPIT_URL ?? 'http://localhost:8025'

interface MailpitSearch {
  messages: { ID: string; Subject: string; Created: string }[]
}

interface MailpitMessage {
  HTML: string
  Text: string
}

/** Waits for the newest email to `to` (optionally with `subject` in it) and returns its HTML and text. */
export async function waitForEmail(
  to: string,
  { subject, timeoutMs = 20_000 }: { subject?: string; timeoutMs?: number } = {},
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs
  const query = encodeURIComponent(`to:"${to}"`)
  for (;;) {
    const res = await fetch(`${mailpitUrl}/api/v1/search?query=${query}`)
    if (res.ok) {
      const body = (await res.json()) as MailpitSearch
      const hit = body.messages.find((m) => !subject || m.Subject.includes(subject))
      if (hit) {
        const msg = await fetch(`${mailpitUrl}/api/v1/message/${hit.ID}`)
        if (msg.ok) return (await msg.json()) as MailpitMessage
      }
    }
    if (Date.now() > deadline) throw new Error(`No email to ${to} within ${timeoutMs} ms (Mailpit at ${mailpitUrl})`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The link carrying `token=` from the email, plus the app-relative path (the email may use another host). */
export function extractTokenLink(message: MailpitMessage): { url: string; path: string; token: string } {
  const source = `${message.HTML}\n${message.Text}`
  const match = /https?:\/\/[^\s"'<>]+[?&]token=([A-Za-z0-9_\-.~%]+)/.exec(source)
  if (!match) throw new Error('No link with token= in the email')
  const url = match[0].replace(/&amp;/g, '&')
  const parsed = new URL(url)
  return { url, path: `${parsed.pathname}${parsed.search}`, token: decodeURIComponent(match[1]) }
}

/** Waits for the email to `to` and returns its token link. */
export async function waitForTokenLink(to: string, opts?: { subject?: string; timeoutMs?: number }) {
  return extractTokenLink(await waitForEmail(to, opts))
}
