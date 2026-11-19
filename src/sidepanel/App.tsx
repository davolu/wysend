import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../brand";
import { policyForHost } from "../lib/policy";
import { TASKS } from "../lib/redaction/cloud";
import { splitByFindings } from "../lib/redaction/engine";
import { ENTITY_HINTS, ENTITY_LABELS, ENTITY_TYPES, type EntityType, type InferenceLabel, type SitePolicy } from "../lib/redaction/types";
import { usePanel } from "./use-panel";

function badgeClass(label: string): string {
  if (label === "In cloud") return "badge cloud";
  if (label === "Blocked" || label === "Unsafe") return "badge heat";
  if (label === "Waiting" || label === "Not run") return "badge wait";
  return "badge";
}

function sourceLabel(source: InferenceLabel | null, fallback: string): string {
  if (source === "on_device") return "On-device";
  if (source === "in_cloud") return "In cloud";
  if (source === "unknown") return "Source not reported";
  return fallback;
}

export function App() {
  const panel = usePanel();
  const site = panel.host || panel.selection?.hostname || "";
  const policy = policyForHost(site, panel.settings);
  const reviewed = panel.assist ? (panel.showRestored ? panel.restored : panel.guardedText) : "";
  const detectBadge = sourceLabel(panel.detectInference, panel.detectSource === "on_device" ? "On-device" : "Rules");
  const taskBadge = panel.assist ? sourceLabel(panel.assist.inferenceSource, "Source not reported") : "Not run";

  return (
    <main className="app">
      <header className="top">
        <div>
          <p className="kicker">Private task</p>
          <h1>{PRODUCT_NAME}</h1>
          <p className="tag">{PRODUCT_TAGLINE}</p>
        </div>
      </header>

      <section className="steps" aria-label="Task steps">
        <div className="step">
          <b>1 · Detect</b>
          <span className={badgeClass(detectBadge)}><i />{detectBadge}</span>
        </div>
        <div className="step">
          <b>2 · Payload</b>
          <span className={badgeClass(panel.audit && !panel.audit.ok ? "Blocked" : panel.approved ? "Approved" : "Waiting")}>
            <i />{panel.audit && !panel.audit.ok ? "Blocked" : panel.approved ? "Approved" : "Local check"}
          </span>
        </div>
        <div className="step">
          <b>3 · Task</b>
          <span className={badgeClass(taskBadge)}><i />{taskBadge}</span>
        </div>
        <div className="step">
          <b>4 · Restore</b>
          <span className={badgeClass(panel.assist ? "On-device" : "Waiting")}><i />{panel.assist ? "On this device" : "Waiting"}</span>
        </div>
      </section>

      <section className="card">
        <h2>Finish this text</h2>
        <p className="note">Select a complaint, contract excerpt, log, or email on any page. Detection runs on the device. Nothing is sent until you approve the payload.</p>
        <div className="row">
          <button className="primary" type="button" onClick={() => void panel.captureSelection()}>Use selection</button>
          <button className="ghost" type="button" onClick={() => void panel.useSample()}>Load sample</button>
        </div>
        <div className="tasks" role="group" aria-label="Task">
          {TASKS.map((item) => (
            <button key={item.id} type="button" aria-pressed={panel.task === item.id} onClick={() => panel.setTask(item.id)} title={item.hint}>
              {item.label}
            </button>
          ))}
        </div>
        {panel.selection ? (
          <div className="diff" aria-label="Selected text">
            {splitByFindings(panel.selection.text, panel.redacted?.findings ?? []).map((part, index) => (
              part.marked ? <mark className="secret" key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
            ))}
          </div>
        ) : (
          <div className="empty">No selection yet. Highlight text and choose “{PRODUCT_NAME}: finish this privately”, or load the sample.</div>
        )}
        {panel.redacted && (
          <div className="diff" aria-label="Redacted text">
            {panel.redacted.text.split(/(\[[A-Z]+_\d+\])/g).map((part, index) => (
              /^\[[A-Z]+_\d+\]$/.test(part) ? <mark className="ph" key={index}>{part}</mark> : <span key={index}>{part}</span>
            ))}
          </div>
        )}
        <div className="row">
          <button className="ghost" type="button" onClick={() => void panel.prepareNano()}>Prepare on-device model</button>
          <button className="ghost" type="button" onClick={() => void panel.refine()} disabled={!panel.selection}>Refine with Nano</button>
        </div>
        <p className="note">{panel.nano.message}</p>
        {panel.nano.state === "downloading" && <progress value={panel.nano.progress} max={1} aria-label="Model download" />}
      </section>

      <section className="card">
        <h2>Outbound payload</h2>
        <p className="note">These are the exact bytes that will be sent to Firebase AI Logic. Raw values from the selection are refused.</p>
        {panel.audit?.ok ? (
          <>
            <div className="meta">
              <span>{panel.audit.bytes} UTF-8 bytes</span>
              <span>{panel.approved ? "Approved" : "Not approved"}</span>
            </div>
            <textarea className="payload" readOnly spellCheck={false} value={panel.audit.payload} aria-label="Exact outbound payload" />
            {panel.digest && <p className="note">SHA-256 {panel.digest}</p>}
            <div className="row">
              <button className="primary" type="button" onClick={panel.approve}>Approve payload</button>
              <button className="ghost" type="button" onClick={() => void panel.runTask()} disabled={!panel.approved || Boolean(panel.busy)}>
                {panel.busy || "Run task"}
              </button>
            </div>
          </>
        ) : (
          <p className="error">{panel.audit?.message ?? "Select text to build a payload."}</p>
        )}
        <div className="segment" role="group" aria-label="Cloud route">
          <button type="button" aria-pressed={panel.settings.cloudMode === "PREFER_IN_CLOUD"} onClick={() => void panel.setCloudMode("PREFER_IN_CLOUD")}>Prefer cloud</button>
          <button type="button" aria-pressed={panel.settings.cloudMode === "ONLY_IN_CLOUD"} onClick={() => void panel.setCloudMode("ONLY_IN_CLOUD")}>Cloud only</button>
        </div>
        <p className="note">Prefer cloud can fall back to the on-device model if the network is down. The fallback still receives only this approved text. Raw text never uses that fallback.</p>
      </section>

      <section className="card">
        <h2>Result</h2>
        {panel.assist ? (
          <>
            <span className={badgeClass(taskBadge)}><i />{taskBadge}</span>
            <div className="result" aria-label="Task result">{reviewed}</div>
            {panel.outputWarning && <p className="warn" role="status">{panel.outputWarning}</p>}
            <label className="toggle">
              <span>Show restored values<small>Restoration happens in this panel. The cloud reply still has placeholders.</small></span>
              <input type="checkbox" checked={panel.showRestored} onChange={(event) => panel.setShowRestored(event.target.checked)} />
            </label>
            <div className="row">
              <button className="primary" type="button" onClick={() => void panel.copyResult()}>Copy</button>
              <button className="ghost" type="button" onClick={() => void panel.insertResult()}>Insert</button>
            </div>
            <p className="note">Inserting restored text types the real values into the page. Leave the toggle off to insert placeholders.</p>
          </>
        ) : (
          <div className="empty">Approve the payload and run a task. The reply is restored here, after the cloud call, so you can read it before copying.</div>
        )}
      </section>

      {(panel.error || panel.notice || panel.busy) && (
        <p className={panel.error ? "error" : "note"} role="status">{panel.error || panel.busy || panel.notice}</p>
      )}

      <section className="card">
        <h2>What to remove</h2>
        {ENTITY_TYPES.map((type: EntityType) => (
          <label className="toggle" key={type}>
            <span>{ENTITY_LABELS[type]}<small>{ENTITY_HINTS[type]}</small></span>
            <input type="checkbox" checked={panel.settings.enabled[type]} onChange={() => void panel.toggleType(type)} />
          </label>
        ))}
      </section>

      <details className="card">
        <summary>Paste protection, secondary</summary>
        <p className="note">Pasting into a page is still checked. The main path is the task above. {site ? `This site: ${site}` : "No active site yet."}</p>
        <div className="segment" role="group" aria-label="Site policy">
          {(["auto-redact", "warn", "block"] as SitePolicy[]).map((value) => (
            <button key={value} type="button" aria-pressed={policy === value} onClick={() => void panel.setPolicy(value)}>{value}</button>
          ))}
        </div>
        {panel.diff ? (
          <>
            <p className="note">Last paste on {panel.diff.hostname}: {panel.diff.findings.length} item{panel.diff.findings.length === 1 ? "" : "s"}.</p>
            <button className="ghost" type="button" onClick={() => void panel.usePaste()}>Finish that draft privately</button>
          </>
        ) : (
          <p className="note">No paste has been intercepted in this session.</p>
        )}
      </details>

      <section className="card">
        <h2>Caught</h2>
        <div className="stats">
          <div className="stat"><b>{panel.stats.secretsCaught}</b><span>secrets caught</span></div>
          <div className="stat"><b>{panel.remote.source === "remote" ? "Remote" : "Built-in"}</b><span>prompt source</span></div>
        </div>
        <p className="note">{panel.remote.detail}</p>
        <div className="row">
          <button className="ghost" type="button" onClick={() => void panel.refreshRemote()}>Refresh Remote Config</button>
          <button className="ghost" type="button" onClick={() => void panel.clearSession()}>Clear session</button>
        </div>
      </section>

      <details className="card">
        <summary>Firebase, optional sign-in</summary>
        <p className="note">Project: {panel.appCheck.projectId ?? "not configured"}. App Check: {panel.appCheck.method}. {panel.appCheck.detail}</p>
        <label className="field">App Check debug token
          <input type="password" value={panel.debugToken} autoComplete="off" onChange={(event) => panel.setDebugToken(event.target.value)} />
        </label>
        <div className="row">
          <button className="primary" type="button" onClick={() => void panel.saveToken()}>Save token and reload</button>
        </div>
        <p className="note">{panel.account.uid ? `Signed in ${panel.account.anonymous ? "anonymously" : ""} ${panel.account.email ?? panel.account.uid}` : "Signed out. Anonymous sign-in is enough to store counts."}</p>
        <div className="row">
          <button className="ghost" type="button" onClick={() => void panel.signIn()}>Sign in</button>
          <button className="ghost" type="button" onClick={() => void panel.signInGoogle()}>Google</button>
          <button className="ghost" type="button" onClick={() => void panel.signOut()}>Sign out</button>
          <button className="ghost" type="button" onClick={() => void panel.shareStats()}>Share counts</button>
        </div>
        <label className="field">Team id
          <input type="text" value={panel.settings.teamId} onChange={(event) => void panel.setTeamId(event.target.value)} />
        </label>
        <div className="row">
          <button className="ghost" type="button" onClick={() => void panel.publishTeam()}>Publish policy</button>
          <button className="ghost" type="button" onClick={() => void panel.applyTeam()}>Apply policy</button>
        </div>
        <label className="toggle">
          <span>Follow Remote Config policy<small>Prompts always come from Remote Config when it can be fetched. This toggle only controls entity defaults.</small></span>
          <input type="checkbox" checked={panel.settings.followRemote} onChange={(event) => void panel.setFollowRemote(event.target.checked)} />
        </label>
      </details>
    </main>
  );
}
