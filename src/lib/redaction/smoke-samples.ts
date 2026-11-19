import type { AssistTask } from "./cloud";

export interface SmokeSample {
  id: string;
  task: AssistTask;
  text: string;
  secrets: string[];
}

/** Fictional texts. The listed secrets must not appear in any cloud payload. */
export const SMOKE_SAMPLES: SmokeSample[] = [
  {
    id: "email",
    task: "reply",
    text: `From: Nora Alvarez
Hi, please refund yesterday's transfer. You can reach me at +1 628 555 0144. The account IBAN is DE89 3704 0044 0532 0130 00.
Thanks,
Nora Alvarez
`,
    secrets: [
      "Nora Alvarez",
      "+1 628 555 0144",
      "DE89 3704 0044 0532 0130 00",
    ],
  },
  {
    id: "medical-note",
    task: "summarize",
    text: `Clinic note

My name is Helen Okonkwo. Please call +44 7700 900123 with the lab result. She lives at 14 Harbor Lane, Bristol.
Assessment: seasonal allergies. No change in medication.
`,
    secrets: [
      "Helen Okonkwo",
      "+44 7700 900123",
      "14 Harbor Lane, Bristol",
    ],
  },
  {
    id: "support-ticket",
    task: "explain",
    text: `Ticket 4412

Customer Jonas Weber cannot sign in after the deploy.
The staging key was pasted into the thread: sk-live-51Hx9a2EXAMPLEKEY1234567890
Thanks,
Jonas Weber
`,
    secrets: [
      "Jonas Weber",
      "sk-live-51Hx9a2EXAMPLEKEY1234567890",
    ],
  },
];
