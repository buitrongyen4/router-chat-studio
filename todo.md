# Project TODO

- [x] Build retro-futurist chat workspace with burnt-orange/sepia gradient, cream typography, yellow slash, and floating background geometry
- [x] Add persistent conversation sidebar with searchable chat history and active conversation state
- [x] Add New Chat flow that starts a fresh conversation without disrupting the current chat state
- [x] Add searchable and scrollable model picker populated from the configured endpoint, with active model shown in the composer
- [x] Add connection settings for provider type, endpoint, API key, storage mode, default model, and connection testing
- [x] Add streamed multi-turn responses with Markdown rendering, fenced code blocks, loading state, stop generation, copy, regenerate, clear, and error handling
- [x] Add Markdown export for the active conversation as a downloadable .md file
- [x] Persist chats, selected models, and connection preferences across refresh/reopen
- [x] Add backend API adapter for 9Router, OpenAI-compatible, and Anthropic-compatible endpoints without exposing API keys to the browser
- [x] Add Vitest coverage for shared endpoint normalization and Markdown export behavior; runtime provider behavior manually verified through type checks
- [x] Verify responsive layout, accessibility, visual polish, and production build

## History

- [x] Initial full-stack project scaffold created
- [x] User refined product direction to retro-futurist visual language and persistent conversations
- [x] User explicitly requested searchable/scrollable model picker, New Chat, and Markdown export

## Notes

- API keys must remain server-side and must never be written to localStorage or emitted in logs.
- The app should remain usable without a configured remote endpoint by showing a clear empty/setup state.
- Persistent chat storage will use the project database for authenticated users, with a local draft fallback for the current browser session if auth is unavailable.
- Streaming will use a server-side provider adapter and a browser-safe incremental response path.


## Follow-up fixes identified during verification

- [x] Replace hardcoded fallback model data with a real manual model-entry fallback and keep picker results sourced from fetched endpoint models when available
- [x] Clarify and implement the connection storage mode semantics; keep API keys session-only while persisting only non-secret preferences
- [x] Fix stop-generation cleanup so cancelled streams never leave empty assistant messages; add cancel-flow test coverage
- [x] Add minimal chat/messages fallback probes when /models is unavailable, including Anthropic and custom provider handling
- [x] Add provider adapter success/error/fallback tests and run the production build plus responsive/accessibility checks

## Final hardening items

- [x] Ensure cancelled streams also prune empty assistant placeholders and add an end-to-end cancellation-flow test
- [x] Add explicit custom connection protocol selection for OpenAI-compatible versus Anthropic-compatible behavior
- [x] Add adapter route success/error/fallback tests and document/run explicit accessibility checks

## Verification evidence

- [x] Add an end-to-end stream cancellation test that verifies no empty assistant placeholder remains
- [x] Run and document explicit accessibility checks for keyboard navigation, focus visibility, dialog semantics, form labels, and contrast

## Last-mile evidence

- [x] Add a browser-level interaction test for starting a stream, invoking Stop, and confirming the cancelled assistant placeholder is absent
- [x] Run explicit accessibility verification for keyboard navigation, focus visibility, dialog semantics, labels, and color contrast, then keep the results in a verification report

## Audit artifact

- [x] Save the accessibility audit procedure and passing results in a dedicated verification report file

## Packaging request

- [x] Prepare a clean source bundle excluding generated dependencies, build output, secrets, logs, and local metadata
- [x] Write standalone deployment and testing instructions for a separate Manus session
- [x] Create and validate the downloadable ZIP archive

## Bug report

- [x] Restore touch and pointer scrolling in the conversation viewport without breaking auto-scroll during streaming
- [x] Verify conversation scrolling on desktop and mobile, then run regression tests and build

> Verification note (2026-08-28): `chat-touch-scroll.e2e.mjs` passed with a real mobile touch drag, and `stream-scroll.e2e.mjs` passed for pinned-bottom, manual-scroll-away, and resume-at-bottom behavior.

## Final scroll verification

- [x] Add a browser/mobile interaction test using a real touch drag on the conversation viewport
- [x] Add streaming auto-scroll regression coverage for pinned-bottom and user-scrolled-away states
- [x] Re-run full verification and update the bug report after touch and streaming tests pass

## Verification note

- [x] Add a dated bug-report note confirming touch-scroll and streaming auto-scroll regressions passed

## Updated ZIP request

- [ ] Create a fresh clean source ZIP from the post-scroll-fix project state
- [ ] Validate the archive contents and prepare it for download
