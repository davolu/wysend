# Local Redact

The name is a placeholder. It lives only in [`src/brand.ts`](src/brand.ts). Change `PRODUCT_NAME` there when the final name is chosen, then rebuild. The side panel, the generated manifest, and this README use that string.

Local Redact lets you finish sensitive work in the browser. Select a complaint, a contract excerpt, a log, or an email and pick a task: draft a reply, summarize, analyze, or explain. Sensitive spans are removed on the device. You read the exact payload that would leave, approve it, and a cloud model does the task on that text only. Placeholders are restored locally, and you review the result before copying or inserting it.

Paste protection is still there. It is a secondary control, not the product.

People already redact pastes. PasteGuard, Cloakpaste, and Hushpaste are examples. This project does not claim to be the first or the only tool of its kind. The difference is hybrid task completion: an on-device pass over the raw text, an auditable outbound payload, and local rehydration.

## Hybrid routing

All model calls go through the Firebase AI Logic Web SDK (`firebase/ai`). There is no other LLM client.

**Detect, raw text.** `getGenerativeModel` is created with `InferenceMode.ONLY_ON_DEVICE`. Gemini Nano runs through Chrome's Prompt API. If Nano is missing, the SDK throws. The extension catches that and keeps the deterministic result. It does **not** use `PREFER_ON_DEVICE` for this step, because that mode uploads the prompt when the local model is unavailable. If a response's `inferenceSource` is `in_cloud`, the entities are discarded.

**Task, approved text only.** You approve one string. `runCloudAssist` sends that string and refuses it first if a vault value or a detector hit is still inside it. The model is `ONLY_IN_CLOUD` or `PREFER_IN_CLOUD`. Prefer-cloud may fall back on-device when the network fails. That fallback is safe only because the payload was already redacted. The badge reads `result.response.inferenceSource`, which the SDK sets to `on_device` or `in_cloud`.

**Restore.** `[PERSON_1]` and the other placeholders are replaced from a vault in `chrome.storage.session`. That mapping is not synced and is not written to Firestore.

Remote Config supplies the on-device prompt, the four task prompts, the cloud model name (`gemini-3.5-flash-lite` by default), and the default entity policy. A bad or missing fetch uses the built-in copies. Remote Config cannot turn off the payload guard or switch raw text to a cloud mode.

## Architecture

```text
selection or paste
    → content script (rules, immediate)
    → side panel
         → Firebase AI Logic ONLY_ON_DEVICE (optional Nano refine)
         → payload preview, byte length, SHA-256, approval
         → Firebase AI Logic PREFER_IN_CLOUD or ONLY_IN_CLOUD
         → local rehydrate → copy or insert
```

- `src/content/interceptor.ts` reads the selection, watches paste and send, and inserts reviewed text.
- `src/background/service-worker.ts` adds the context-menu item and the toolbar badge.
- `src/sidepanel` is the review surface: diff, outbound payload, task, result, stats.
- `src/lib/redaction` is the deterministic engine, vault, payload guard, and eval.
- `src/lib/firebase` is the only place that calls Firebase AI Logic, App Check, Auth, Firestore, and Remote Config.

Firestore documents are counts (`stats/{uid}`) and team policies (`teams/{teamId}`). Security rules allow those shapes and deny everything else. Raw text is not a field.

## Detection quality

`npm run eval` scores the rules layer on [`src/lib/redaction/dataset.ts`](src/lib/redaction/dataset.ts): 50 synthetic samples, 44 labeled entities, in English, Spanish, French, German, Portuguese, and Japanese. A prediction matches a label when the type matches and the canonical value matches (digit forms for numbers, containment for names and addresses). Matching is one-to-one.

| | |
|---|---:|
| Samples | 50 |
| Labeled entities | 44 |
| Precision | 100% (44/44) |
| Recall | 100% (44/44) |

| Type | Precision | Recall | TP | FP | FN |
|---|---:|---:|---:|---:|---:|
| PERSON | 100% | 100% | 12 | 0 | 0 |
| PHONE | 100% | 100% | 10 | 0 | 0 |
| EMAIL | 100% | 100% | 4 | 0 | 0 |
| ADDRESS | 100% | 100% | 6 | 0 | 0 |
| BANK | 100% | 100% | 3 | 0 | 0 |
| BVN | 100% | 100% | 1 | 0 | 0 |
| NIN | 100% | 100% | 1 | 0 | 0 |
| CARD | 100% | 100% | 1 | 0 | 0 |
| SSN | 100% | 100% | 1 | 0 | 0 |
| API_KEY | 100% | 100% | 3 | 0 | 0 |
| SECRET | 100% | 100% | 2 | 0 | 0 |

Regenerate the table with `npm run eval`. The score means the rules agree with this labeled set, which includes negatives (invoice numbers, versions, prices) that must not match. It is not a general measure of named-entity recognition. An uncued name such as "Ask Zubby" is intentionally not in the set; that case is what the on-device model is for. Labeled BVN and NIN values are one supported format among phones, IBANs, SSNs, and street addresses from several countries.

## What you have to do in Firebase

The extension runs locally with rules-only redaction and the sample desk even before Firebase is filled in. Cloud tasks, Nano through the SDK, Remote Config, Auth, and Firestore do nothing until you complete the steps below. Nobody else can do these for you. Do not commit `.env`, a debug token, or a built `dist` that contains one.

1. **Create a Firebase project.** In the [Firebase console](https://console.firebase.google.com/), create a project. Google Analytics is optional. You do not need the Blaze plan for the default text model. Confirm the current model on the [Firebase AI Logic models list](https://firebase.google.com/docs/ai-logic/models) before you rely on a name other than `gemini-3.5-flash-lite`.

2. **Register a Web app and copy its config.** Project settings → Your apps → Web. Add the six values to a new `.env` file, using [`.env.example`](.env.example) as the template. Rebuild after every change to `.env`. The API key is a public client identifier. It is still not something to paste into a ticket.

3. **Turn on Firebase AI Logic with the Gemini Developer API.** In the console open **AI Services → AI Logic → Get started** and choose the Gemini Developer API. Or, after `npx -y firebase-tools@latest login` and `npx -y firebase-tools@latest use YOUR_PROJECT_ID`, run `npx -y firebase-tools@latest init ailogic`. Registering the web app does not enable the API. Without this step, cloud calls fail with permission denied.

4. **Enforce App Check.** The AI Logic setup usually enforces it. Check **Security → App Check → APIs** and enforce **Firebase AI Logic**. Also enforce **Cloud Firestore** if you use counts or team policies. The hackathon accepts debug tokens. Do not commit them.

5. **Create the extension debug token.** Manifest V3 pages cannot load the remote reCAPTCHA script, so reCAPTCHA Enterprise does not attest this extension by itself. Use the debug provider:
   - Open the side panel after a build.
   - Enter any UUID you generate yourself, or leave the field empty once, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in a local build, reload, and copy the token the SDK prints in the side-panel console (`Firebase App Check debug token: ...`).
   - Save it in the panel. It is stored in `chrome.storage.local` on this profile. Putting `VITE_APPCHECK_DEBUG_TOKEN` in `.env` also works, but that value is compiled into `dist`. Do not publish that build.
   - In the console, open **Security → App Check → Apps → Manage debug tokens** and register the same token.
   - A production website can use a score-based [reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) key in `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Do not add `localhost` to a key you ship. The extension path remains the debug token.

6. **Authentication, optional.** Enable **Anonymous** under Authentication → Sign-in method. That is enough for counts and team policies. Google sign-in also needs an OAuth client whose redirect URI is `https://YOUR_EXTENSION_ID.chromiumapp.org/`, and `VITE_GOOGLE_OAUTH_CLIENT_ID` set before you rebuild.

7. **Firestore, optional.** Create a database in production mode. Deploy the rules in this repo: `npx -y firebase-tools@latest deploy --only firestore:rules`. The rules allow numeric counts and a small policy document. They do not allow a free-form text field.

8. **Remote Config, optional.** Create the parameters in [`remoteconfig.template.json`](remoteconfig.template.json), or import that file, and publish. The extension works with built-in prompts if you skip this. Fetch is cached for about a minute; **Refresh Remote Config** in the panel forces a new fetch.

9. **Chrome, for Gemini Nano.** Desktop Chrome 139 or newer (`chrome://settings/help`). Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart. The hackathon FAQ also says to search `chrome://flags` for **Gemma 4 for Built-in AI** and enable it. Optional warm-up in DevTools: `await LanguageModel.availability()` then `await LanguageModel.create()`. In the side panel, click **Prepare on-device model** once. That click is the user gesture the SDK requires before `initializeDeviceModel()`. The download can take several minutes. Until it finishes, rules still redact and raw text is not sent to the cloud.

10. **Load the extension.** `npm install`, `npm test`, `npm run build`, then Chrome → Extensions → Developer mode → **Load unpacked** → select `dist`.

## Run locally

```bash
npm install
npm test          # redaction, rehydration, payload guard, routing, eval
npm run eval      # prints the precision/recall table
npm run build     # dist/ is the unpacked extension
npm run demo      # sample desk at http://127.0.0.1:43123
npm run dev       # side panel layout at http://127.0.0.1:43117/sidepanel.html
```

`npm run dev` has no `chrome` object, so it shows the sample and the payload without calling Firebase. Cloud tasks run from the loaded extension.

## Privacy

- The vault and the last selection live in `chrome.storage.session`.
- Settings and aggregate counts live in `chrome.storage.local`.
- Sharing stats uploads numbers only, after you sign in and click the button.
- Team policies are hostnames and the three policy values, not document text.
- The outbound view is the string passed to `generateContent`. If it still contains a detected secret, the call is refused before the SDK is asked.

## License

[Apache License 2.0](LICENSE).
