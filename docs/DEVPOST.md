# Devpost draft

Platform: Web (Chrome extension).

## Tagline

Finish a reply, summary, or analysis on sensitive text without sending the raw text to the cloud.

## About

Support leads, operators, and anyone else who works in a browser often need a model to finish a piece of writing: answer a complaint, summarize a thread, explain a log, look at a contract excerpt. The useful output is not the problem. The problem is that the source text contains names, phone numbers, addresses, account and card numbers, national IDs, and API keys.

Local Redact is a Chrome extension. The name is a placeholder stored in `src/brand.ts`. You select text on any page and pick a task: draft reply, summarize, analyze, or explain. Deterministic detectors, and Gemini Nano when it is available, remove sensitive spans on the device and replace them with stable placeholders such as `[PERSON_1]`. You then see the exact UTF-8 payload that would leave the device, including its byte length and SHA-256, and you approve it. Firebase AI Logic runs the task on that approved text only. Placeholders in the answer are restored locally, and you review the result before copying or inserting it.

Paste protection remains available as a secondary control, with per-site block, warn, or auto-redact behavior. It is not the product.

Related tools already redact what you paste, including PasteGuard, Cloakpaste, and Hushpaste. This project does not claim to be the first or the only one. The difference is hybrid task completion: raw text stays on `ONLY_ON_DEVICE`, the cloud call is an explicit approved payload, and rehydration never happens on the server.

## How Firebase AI Logic is used

- Detection of raw text uses `InferenceMode.ONLY_ON_DEVICE`. If Nano is unavailable, the SDK throws and the extension keeps the rules result. It does not fall back to the cloud with the raw text. `PREFER_ON_DEVICE` would upload the prompt when the local model is missing, so it is not used for this step.
- The task uses `ONLY_IN_CLOUD` or `PREFER_IN_CLOUD`. Prefer-cloud may fall back on-device when the network fails, but only with the already approved redacted payload. Each response shows the SDK `inferenceSource` (`on_device` or `in_cloud`).
- Prompts, the cloud model name, and the default redaction policy come from Remote Config, with built-in defaults when the fetch fails.
- App Check is initialized before any Firebase call. In the extension this is a debug token registered in the console, which is the path that works under Manifest V3. reCAPTCHA Enterprise is supported when a site key is configured, and documented as the production web provider. Debug tokens are not committed.
- Optional anonymous or Google sign-in. Firestore stores aggregate counts and team policies only. Rules reject any other shape. Raw text is not written.

## Built during this submission

The extension was created during the #BuildHybridAI 2026 submission period. There is no pre-existing application underneath it.

## Detection quality

`npm run eval` scores the deterministic detector on 50 synthetic samples in English, Spanish, French, German, Portuguese, and Japanese. The current result is precision 100% (44/44) and recall 100% (44/44) on the labeled spans. That measures agreement with this labeled set, including negatives that should stay untouched. It is not a claim about every name in the wild. Uncued names are left for the on-device model.

## Testing instructions

1. Clone the repo. Do not expect a committed `.env` or App Check token.
2. Follow the README section "What you have to do in Firebase".
3. `npm install`, `npm test`, `npm run build`.
4. Load `dist` as an unpacked extension in Chrome 139+ with the on-device model flag enabled.
5. `npm run demo`, select the complaint, and run a task from the side panel.
6. Confirm the outbound payload contains placeholders and not the phone number, email, card, or key.

No production API keys, live project secrets, or real personal data are included.
