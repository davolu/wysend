/**
 * Live cloud smoke test. Node 20 or newer, outside Chrome.
 *
 *   VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=... npm run smoke:cloud
 *
 * The token is read from the environment or from .env.local.
 * initializeAppCheck logs "Firebase App Check debug token: <token>".
 * suppressAppCheckDebugTokenConsole() drops that line, and errors are
 * redacted with the token value, so the token never appears in the output.
 */
import { existsSync, readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { resolveFirebaseConfig, resolveRecaptchaEnterpriseSiteKey } from "../src/firebaseConfig";
import { installAppCheckDebugToken, suppressAppCheckDebugTokenConsole } from "../src/lib/firebase/app-check-debug";
import { prepareCloudAssist } from "../src/lib/redaction/cloud";
import { guardModelPlaceholders, modelOutputWarning, redact, rehydrate } from "../src/lib/redaction/engine";
import { SMOKE_SAMPLES } from "../src/lib/redaction/smoke-samples";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";
import { DEFAULT_CLOUD_MODEL } from "../src/lib/firebase/ai";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function hideSecret(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join("[redacted-secret]");
}

suppressAppCheckDebugTokenConsole();
loadEnvFile(".env.local");
loadEnvFile(".env");

const config = resolveFirebaseConfig(process.env);
const recaptchaSiteKey = resolveRecaptchaEnterpriseSiteKey(process.env);
const debugToken = (
  process.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
  || process.env.VITE_APPCHECK_DEBUG_TOKEN
  || ""
).trim();

console.log(`Firebase project: ${config.projectId}`);
console.log(`Cloud model: ${DEFAULT_CLOUD_MODEL}`);
console.log("Inference mode: ONLY_IN_CLOUD (Gemini Developer API)");

const app = initializeApp(config);

if (!debugToken) {
  console.log(
    "App Check: VITE_FIREBASE_APPCHECK_DEBUG_TOKEN is not set. Put it in .env.local (gitignored). Debug exchange cannot run. The cloud call will still be attempted.",
  );
} else {
  installAppCheckDebugToken(debugToken);
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("App Check: debug token was set on globalThis and self before initializeAppCheck. ReCaptchaEnterpriseProvider is using the configured site key. The token value is not printed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("App Check cannot be initialized in Node. The cloud call will still be attempted.");
    console.log(hideSecret(message, debugToken));
  }
}
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_IN_CLOUD,
  inCloudParams: {
    model: DEFAULT_CLOUD_MODEL,
    generationConfig: { maxOutputTokens: 512 },
  },
});

let failed = false;

for (const sample of SMOKE_SAMPLES) {
  console.log(`\n=== ${sample.id} (${sample.task}) ===`);
  try {
    const redacted = redact(sample.text, { enabled: emptyEnabled() }, emptyVault());
    const prepared = prepareCloudAssist(sample.task, redacted.text, redacted.vault);
    const leaks = sample.secrets.filter((secret) => prepared.payload.includes(secret));
    console.log(`Outbound payload (${prepared.bytes} UTF-8 bytes):`);
    console.log(prepared.payload);
    if (leaks.length > 0) {
      failed = true;
      console.error(`FAIL: outbound payload still contains: ${leaks.join(", ")}`);
      continue;
    }
    console.log("Payload check: no original sensitive value is present.");
    const result = await model.generateContent(prepared.payload);
    const cloudText = result.response.text();
    const source = result.response.inferenceSource ?? "not reported";
    console.log(`Cloud inferenceSource: ${source}`);
    console.log("Cloud response:");
    console.log(cloudText);
    const guarded = guardModelPlaceholders(cloudText, redacted.vault);
    const warning = modelOutputWarning(guarded);
    if (warning) console.log(warning);
    console.log("Restored locally:");
    console.log(rehydrate(guarded.text, redacted.vault));
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${sample.id}: ${hideSecret(message, debugToken)}`);
  }
}

if (failed) {
  console.error("\nSmoke test failed.");
  process.exit(1);
}
console.log("\nSmoke test passed.");
