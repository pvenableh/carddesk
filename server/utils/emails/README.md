# CardDesk transactional emails

Branded HTML emails (welcome, password reset) **designed in MJML** and rendered
with a tiny built-in token engine — **no `mjml` or `handlebars` npm packages**.

> ⚠️ **Don't `pnpm add mjml handlebars`, and don't paste the compiled HTML into a
> `.ts` file.** Either one ends up in the Nitro server bundle and **breaks the
> production build** — MJML's HTML can't survive esbuild's bundle transform (it
> gets misreported as a syntax error in `server/api/ai-*.ts`). Instead we compile
> MJML in the **desktop app** and save the HTML as a **static asset** that's read
> at runtime (never bundled).

## Files

| File | What it is |
|---|---|
| `mjml/*.mjml` | **Design source — local-only (gitignored).** Edit in the MJML desktop app; keep your own copies. Not in the repo, since the committed artifact is the compiled HTML below. |
| `../../assets/emails/*.html` | **Compiled HTML**, one file per email. Read at runtime via `useStorage('assets:emails')`. Registered in `nuxt.config.ts → nitro.serverAssets`. |
| `shell.ts` | `renderEmail(html, text, data)` fills `{{tokens}}`; `loadEmailHtml(name)` reads the asset. |
| `welcome.ts` / `password-reset.ts` | Per-email modules: copy + data → `{ subject, html, text }` (async). |

## How to change an email design

1. **Open the source** in the MJML desktop app, e.g.
   `server/utils/emails/mjml/welcome.mjml`.
2. **Edit** the design. Keep the placeholder tokens intact (see *Tokens* below) —
   they're filled per-send at runtime.
3. **Export the compiled HTML** (the app's *Export → HTML*, or copy the rendered
   HTML from the preview).
4. **Save it over the matching asset** — paste the raw HTML, no escaping needed:
   - welcome  →  `server/assets/emails/welcome.html`
   - password reset  →  `server/assets/emails/password-reset.html`
5. **Verify:** `pnpm build` should complete clean. (If you add a *new* email,
   also add its `.html` here — `nitro.serverAssets` picks up the whole folder.)

That's it. `welcome.ts` / `password-reset.ts` load these at runtime, so callers
(`/api/auth/register`, `/api/auth/password-request`) don't change.

## Tokens

`shell.ts` supports a small Handlebars subset:

- `{{var}}` — inserts a value (HTML-escaped in the HTML body, raw in the text body)
- `{{#if var}}…{{else}}…{{/if}}` — conditional block

Available per email (the `data` passed in each module):

| Email | Tokens |
|---|---|
| **welcome** | `{{firstName}}`, `{{appUrl}}`, `{{preheader}}` |
| **password-reset** | `{{firstName}}`, `{{resetUrl}}`, `{{expiresIn}}`, `{{preheader}}` |

Greeting pattern: `Hey {{#if firstName}}{{firstName}}{{else}}there{{/if}},`

> In MJML, put these tokens straight into the text content (e.g. `{{firstName}}`).
> The desktop app passes them through to the exported HTML untouched.

## Adding a new email

1. Design `mjml/<name>.mjml`, export → save `server/assets/emails/<name>.html`.
2. Add a `<name>.ts` module modeled on `welcome.ts`: a text fallback + an
   `async` function that does
   `renderEmail(await loadEmailHtml('<name>'), TEXT, data)` and returns
   `{ subject, html, text }`.
3. Call it (with `await`) from the relevant API route.
