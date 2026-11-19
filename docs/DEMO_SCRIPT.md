# Three-minute demo

Record in English, on desktop Chrome, with the extension loaded. Stay under three minutes. Use this sample desk (`npm run demo`) so the video does not depend on another product's interface. Do not show third-party logos.

The product name on screen comes from `src/brand.ts`. Today that placeholder is **Local Redact**.

## 0:00–0:30 — Who, the problem, hybrid, airplane

Open on the sample complaint.

"This is for anyone who has to finish real work on sensitive text: a support lead answering a complaint, a lawyer reading a contract clause, an engineer staring at a log. The useful part is the reply, the summary, the analysis. The risky part is handing the raw name, phone, card, or key to a cloud model."

Toggle airplane mode, or say you are about to.

"Hybrid is what makes that possible. Gemini Nano, through Firebase AI Logic, reads the raw text only on this device. You see the exact payload that would leave, and you approve it. The cloud model does the task on placeholders. The real values come back only here. Watch: the network is off, and detection still runs."

Paste or select the complaint again while offline. Point at the **Rules** or **On-device** badge. Cloud task either falls back on-device (Prefer cloud, badge changes) or stops with a clear error (Cloud only). The raw complaint never needed the network.

## 0:30–1:20 — Select, redact, show the payload

Turn the network back on if you turned it off.

Select the complaint. Right-click, **Local Redact: finish this privately**, or click **Use selection**.

Show the marked original and the placeholder version. Click **Prepare on-device model** if Nano is still downloading, and point at the progress. If Nano is missing, say the rules still redacted it and the cloud was not used as a fallback for the raw text.

Open **Outbound payload**. Read the byte count. Scroll so a placeholder and the absence of the phone number are both visible. Click **Approve payload**.

## 1:20–2:10 — Task, badge, restore

Choose **Draft reply**. Click **Run task**. When it returns, point at the step 3 badge: **In cloud** or **On-device**, taken from the SDK's inference source.

Turn on **Show restored values**. The name and phone reappear in the panel only. Copy, then paste into the reply box. Say you reviewed it before it touched the page.

## 2:10–2:40 — What is not sent, and the secondary paste

Collapse nothing: show that entity toggles exist, and that paste protection is labeled secondary. Paste the raw complaint into the reply box and show the warn or auto-redact behavior for this site.

Mention the score in one sentence: the rules layer is measured on 50 synthetic samples across several languages, and uncued names are left for the on-device model. Do not claim the score is a general benchmark.

## 2:40–3:00 — Close

"People already redact pastes. The difference here is finishing the task: on-device removal, a payload you can read, a cloud model that only sees that payload, and the real values restored on the machine before you copy anything."

End on the side panel, steps 1 to 4 visible.
