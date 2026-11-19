# Wysend

**Tagline:** The cloud never sees your secrets. You see exactly what it sees.

**Platform:** Web (Chrome extension)

## Inspiration

People do real work in AI chats. A support lead drafts a reply to a complaint. A founder summarizes a contract clause. An engineer asks a model to explain a log. The useful part is the answer. The risky part is the source: names, phone numbers, addresses, account numbers, card numbers, national IDs, and API keys, copied straight into a prompt.

Paste-redaction tools already exist. They stop a secret on the way into a box. They do not help you finish the task, and they do not show you the exact bytes a cloud model will receive. Wysend, pronounced WHY-send, is “what you see is what you send.” You approve one payload. That payload is the only thing the cloud model sees. The real values come back on your machine, after the call, so you can read the result before you copy it anywhere.

## What it does

Wysend is a Manifest V3 Chrome extension. Select text on any page, or right-click it, and choose a task: draft a reply, summarize, analyze, or explain.

1. **Detect.** Deterministic detectors run immediately. When Gemini Nano is available, Firebase AI Logic runs a second pass with `ONLY_ON_DEVICE`. Spans become stable placeholders such as `[PERSON_1]` and `[API_KEY_1]`. The mapping stays in `chrome.storage.session`.
2. **Show the payload.** The side panel prints the exact UTF-8 string that would leave the device, its byte length, and a SHA-256. You approve that string.
3. **Run the task.** Firebase AI Logic sends only the approved string, using `ONLY_IN_CLOUD` or `PREFER_IN_CLOUD`. The badge reads the SDK’s `inferenceSource`: `on_device` or `in_cloud`.
4. **Restore locally.** Placeholders in the answer are filled back in on the device. You copy or insert the result after you have read it.

Paste protection remains as a secondary control: per site, the extension can auto-redact, warn, or block. It is not the product.

If Nano is missing or still downloading, the rules still redact. Raw text is never sent to the cloud as a fallback.

## How we built it

TypeScript, Vite, and React for the side panel. A content script captures the selection and watches paste and send. The service worker adds the context menu and the toolbar badge. The redaction engine, the vault, and the payload guard are plain modules with unit tests, so the privacy check does not depend on a model being available.

All model calls go through the Firebase AI Logic Web SDK (`firebase/ai`) with the Gemini Developer API backend. There is no other LLM client.

The public web config for the Firebase project is the default in `src/firebaseConfig.ts`. The App Check debug token is not in the repo. It is read from `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` in `.env.local`, or typed into the side panel.

## Hybrid inference

Wysend uses two model instances on purpose.

**Raw text uses `ONLY_ON_DEVICE`.** Gemini Nano runs through Chrome’s Prompt API. If the on-device model is unavailable, the SDK throws. Wysend keeps the deterministic redaction and does not switch that prompt to the cloud. `PREFER_ON_DEVICE` would upload the raw text when Nano is missing, so it is the wrong mode for this step. If a response reports `inferenceSource: in_cloud`, those entities are discarded.

**The task uses `ONLY_IN_CLOUD` or `PREFER_IN_CLOUD`.** The call is made only after you approve the redacted payload, and the guard refuses the call if any original secret is still in that string. `PREFER_IN_CLOUD` may fall back to the on-device model when the network is down. That fallback is acceptable because the text is already redacted. `ONLY_IN_CLOUD` fails closed instead, which is the right choice when you want a cloud answer or nothing.

Each step in the side panel has its own badge. Detection is “Rules” or “On-device.” The task badge is the SDK signal, “On-device” or “In cloud.” Restoration is always local.

## Firebase AI Logic and App Check

Firebase AI Logic is required, and App Check is enforced on it. The web app is registered with reCAPTCHA Enterprise. The site key is public and is the default for `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY`.

A Chrome extension page cannot load the remote reCAPTCHA script under Manifest V3, so the extension and the Node smoke test use the App Check debug provider. Before `initializeAppCheck`, the code sets `globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN` and `self.FIREBASE_APPCHECK_DEBUG_TOKEN`, then constructs `ReCaptchaEnterpriseProvider` with the site key. In Node, `self` is normally missing, so the script publishes `globalThis` as `self` first. Firebase looks at `self` before `global`. The debug token itself is never committed.

With enforcement on, `npm run smoke:cloud` and no token is rejected:

`[401 Unauthorized] Firebase App Check token is invalid.`

The same command with the registered token in `.env.local` is how you confirm the debug path.

Optional Firebase pieces, used only for non-text data:

- **Authentication:** anonymous sign-in, with Google as an extra option.
- **Cloud Firestore:** numeric “secrets caught” counts and team policy documents. Rules allow those shapes and deny everything else. Raw text is not a field.
- **Remote Config:** the on-device prompt, the four task prompts, the cloud model name, and the default entity policy. Built-in copies are used if the fetch fails. Remote Config cannot turn off the payload guard or move raw text onto a cloud mode.

The cloud model is `gemini-3.5-flash-lite`.

## Evaluation

`npm run eval` scores the deterministic detector on 50 synthetic samples and 44 labeled entities, written in English, Spanish, French, German, Portuguese, and Japanese. A prediction matches when the type matches and the canonical value matches. Matching is one-to-one. Negatives (invoice numbers, versions, prices, times) are in the set and must not match.

| | |
|---|---:|
| Precision | 100% (44/44) |
| Recall | 100% (44/44) |

That is agreement with this labeled set. It is not a claim about every name in the wild. A name with no cue, such as “Ask Zubby,” is left for the on-device model and is not in the score.

`npm run smoke:cloud` runs three realistic samples through the live `ONLY_IN_CLOUD` path: an email with a name, phone, and IBAN; a clinic note; and a support ticket with an API key. It prints the outbound payload, the cloud response, and the locally restored text, and it exits nonzero if any original secret is still in the payload.

## Challenges

- Manifest V3 blocks the reCAPTCHA script, so the extension cannot complete a normal Enterprise attestation. The debug token is the path that works, and it has to be set before `initializeAppCheck` or the SDK never enters debug mode.
- Enforcement is real. A call with no token returns 401 even when the payload is already redacted.
- On-device inference needs a user gesture and a model download. The panel shows download progress and keeps working on rules until Nano is ready.
- Chrome’s `self` binding does not exist in Node. The smoke test has to publish the token on both `globalThis` and `self`, because that is the object Firebase checks first.

## What's next

Richer on-device prompts for names that have no surrounding cue. A clearer team-policy flow once Firestore rules are deployed. A hosted page that can use reCAPTCHA Enterprise directly, for people who want the same review step outside the extension.

## Built with

- Chrome Extension, Manifest V3
- TypeScript
- Vite
- React
- Firebase AI Logic, Gemini Developer API (`gemini-3.5-flash-lite`)
- Gemini Nano through the Chrome Prompt API
- Firebase App Check, reCAPTCHA Enterprise, debug token for the extension
- Firebase Remote Config
- Firebase Authentication
- Cloud Firestore
- Vitest
