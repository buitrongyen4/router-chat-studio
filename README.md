# Router Chat Studio

Router Chat Studio is a local-first browser chat client for 9Router and compatible OpenAI or Anthropic endpoints. It keeps the normal AI workflow in the browser while routing provider requests through the local Express server, so the API key is never placed in frontend source code or browser storage.

## Included experience

The app opens to a warm retro-futurist conversation deck with a persistent chat sidebar, New Chat flow, searchable conversation history, a searchable and scrollable model picker, a Markdown-aware composer, streamed assistant output, stop/copy/regenerate/clear actions, connection diagnostics, and Markdown export.

## Connect a provider

Open **Connection settings**, choose the provider type, enter the base URL and API key, and use **Check connection**. The app requests `/v1/models` through the server. When model discovery is unavailable, it sends a minimal non-streaming probe to the selected compatible route and leaves a manual model ID field available in the model picker.

The following compatibility modes are supported:

| Provider setting | Request route | Authentication style |
| --- | --- | --- |
| 9Router / OpenAI Compatible | `/v1/chat/completions` | `Authorization: Bearer …` |
| OpenAI Compatible | `/v1/chat/completions` | `Authorization: Bearer …` |
| Anthropic Compatible | `/v1/messages` | `x-api-key` + `anthropic-version` |
| Custom | Select OpenAI-compatible or Anthropic-compatible | Matching selected protocol |

A base URL may include `/v1`; the server normalizes it without duplicating the path. The key is held in server memory for the active session. The optional **Remember connection preferences** switch persists only the non-secret connection name, provider type, endpoint, and default model in browser storage. The API key is never persisted.

## Local development

The project uses the scaffolded React, Vite, TypeScript, Express, and tRPC environment. From the project root, install dependencies if necessary and run:

```bash
pnpm install
pnpm dev
```

Use the preview address supplied by the project environment. The browser is the normal interface; Terminal is only needed to start or stop the app.

## Project map

| Path | Responsibility |
| --- | --- |
| `client/src/pages/Home.tsx` | Main chat workspace, settings modal, model picker, persistence, Markdown export |
| `client/src/lib/streamSession.ts` | Browser-safe incremental SSE reader and cancellation cleanup |
| `server/chatApi.ts` | Secure connection management, model discovery, protocol adapters, probe fallback, and SSE proxy |
| `shared/chatUtils.ts` | Shared endpoint normalization, Markdown export, and stream cleanup helpers |
| `server/chatApi.test.ts` | Adapter payload and route success/error/fallback tests |
| `server/chatUtils.test.ts` | Shared helper tests |
| `client/src/lib/streamSession.test.ts` | End-to-end cancellation-path test for stream placeholder cleanup |

## Security notes

The provider API key is accepted only by the server routes under `/api/connection` and is not returned in any response. Error messages are shortened and redact common key-like strings. The connection is intentionally session-only for secrets; reopening the server requires entering the key again. Conversations, selected models, and non-secret connection preferences are stored locally so the user can return to prior work after refreshing or reopening the app.

## Validation

The project includes unit and route tests, TypeScript checking, and a production build. The UI was visually reviewed at desktop and narrow mobile widths. Interactive elements have semantic buttons and labels, dialogs expose `role="dialog"` and `aria-modal`, the model menu exposes `aria-expanded`, Escape closes overlays, and `:focus-visible` styling remains visible against the dark palette.
