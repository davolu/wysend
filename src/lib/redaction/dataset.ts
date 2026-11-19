import type { EntityType } from "./types";

export interface LabeledEntity {
  type: EntityType;
  text: string;
}

export interface LabeledSample {
  id: string;
  lang: string;
  text: string;
  entities: LabeledEntity[];
}

const item = (
  id: string,
  lang: string,
  text: string,
  entities: LabeledEntity[] = [],
): LabeledSample => ({ id, lang, text, entities });

/** Synthetic labeled set for the deterministic detector. Not real customer data. */
export const DATASET: LabeledSample[] = [
  item("en-person-for", "en", "Please update the file for Maya Chen before Friday.", [{ type: "PERSON", text: "Maya Chen" }]),
  item("en-person-sign", "en", "Thanks,\nLuis Ortega", [{ type: "PERSON", text: "Luis Ortega" }]),
  item("en-person-from", "en", "From: Helen Brooks\nThe shipment left yesterday.", [{ type: "PERSON", text: "Helen Brooks" }]),
  item("es-person", "es", "Me llamo Lucia Navarro y necesito una copia.", [{ type: "PERSON", text: "Lucia Navarro" }]),
  item("es-sign", "es", "Atentamente,\nSofia Alvarez", [{ type: "PERSON", text: "Sofia Alvarez" }]),
  item("fr-person", "fr", "Je m'appelle Camille Bernard, du service client.", [{ type: "PERSON", text: "Camille Bernard" }]),
  item("fr-sign", "fr", "Cordialement,\nHugo Martin", [{ type: "PERSON", text: "Hugo Martin" }]),
  item("de-person", "de", "Mein Name ist Anna Schmidt aus Berlin.", [{ type: "PERSON", text: "Anna Schmidt" }]),
  item("de-sign", "de", "Mit freundlichen Grüßen,\nJonas Weber", [{ type: "PERSON", text: "Jonas Weber" }]),
  item("pt-person", "pt", "Meu nome é João Silva e aguardo retorno.", [{ type: "PERSON", text: "João Silva" }]),
  item("pt-sign", "pt", "Atenciosamente,\nMarina Costa", [{ type: "PERSON", text: "Marina Costa" }]),
  item("en-email", "en", "Reach me at maya.chen@example.com today.", [{ type: "EMAIL", text: "maya.chen@example.com" }]),
  item("de-email", "de", "Schreiben Sie an anna.schmidt@example.de bitte.", [{ type: "EMAIL", text: "anna.schmidt@example.de" }]),
  item("fr-email", "fr", "Mon adresse est camille.bernard@example.fr.", [{ type: "EMAIL", text: "camille.bernard@example.fr" }]),
  item("us-phone-plus", "en", "Her mobile is +1 415 555 0198 after lunch.", [{ type: "PHONE", text: "+1 415 555 0198" }]),
  item("us-phone-paren", "en", "Desk line (415) 555-0148 is staffed.", [{ type: "PHONE", text: "(415) 555-0148" }]),
  item("uk-phone", "en", "Call +44 7700 900123 if the gate is locked.", [{ type: "PHONE", text: "+44 7700 900123" }]),
  item("fr-phone", "fr", "Téléphone +33 6 12 34 56 78 ce matin.", [{ type: "PHONE", text: "+33 6 12 34 56 78" }]),
  item("de-phone", "de", "Mobil +49 151 23456789 ist erreichbar.", [{ type: "PHONE", text: "+49 151 23456789" }]),
  item("ng-phone-plus", "en", "The callback number is +234 803 555 0142.", [{ type: "PHONE", text: "+234 803 555 0142" }]),
  item("ng-phone-local", "en", "Alternate line 08035550142 if the first fails.", [{ type: "PHONE", text: "08035550142" }]),
  item("jp-phone", "ja", "連絡先は +81 90 1234 5678 です。", [{ type: "PHONE", text: "+81 90 1234 5678" }]),
  item("br-phone", "pt", "Celular +55 11 98888 7766 à tarde.", [{ type: "PHONE", text: "+55 11 98888 7766" }]),
  item("in-phone", "en", "WhatsApp +91 98765 43210 is monitored.", [{ type: "PHONE", text: "+91 98765 43210" }]),
  item("uk-address", "en", "The contract address is 18 Baker Street, London.", [{ type: "ADDRESS", text: "18 Baker Street, London" }]),
  item("us-address", "en", "Ship to 500 Market Street, San Francisco.", [{ type: "ADDRESS", text: "500 Market Street, San Francisco" }]),
  item("fr-address", "fr", "Bureau au 12 Rue de Rivoli cette semaine.", [{ type: "ADDRESS", text: "12 Rue de Rivoli" }]),
  item("de-address", "de", "Treffen an der Hauptstraße 12 um neun.", [{ type: "ADDRESS", text: "Hauptstraße 12" }]),
  item("es-address", "es", "La tienda está en Calle Mayor 12.", [{ type: "ADDRESS", text: "Calle Mayor 12" }]),
  item("labeled-address", "en", "She lives at 42 Ocean Avenue, Miami.", [{ type: "ADDRESS", text: "42 Ocean Avenue, Miami" }]),
  item("iban-de", "de", "IBAN: DE89 3704 0044 0532 0130 00", [{ type: "BANK", text: "DE89 3704 0044 0532 0130 00" }]),
  item("iban-gb", "en", "Use IBAN GB82 WEST 1234 5698 7654 32 for the refund.", [{ type: "BANK", text: "GB82 WEST 1234 5698 7654 32" }]),
  item("account", "en", "Account number: 0123456789 is the operating account.", [{ type: "BANK", text: "0123456789" }]),
  item("bvn", "en", "BVN: 22334455667 was printed on the form.", [{ type: "BVN", text: "22334455667" }]),
  item("nin", "en", "NIN: 12345678901 is on the same form.", [{ type: "NIN", text: "12345678901" }]),
  item("ssn", "en", "SSN: 219-09-9999 appears on the tax page.", [{ type: "SSN", text: "219-09-9999" }]),
  item("card", "en", "Card: 4242 4242 4242 4242 expires next year.", [{ type: "CARD", text: "4242 4242 4242 4242" }]),
  item("api-sk", "en", "The staging key is sk-live-51Hx9a2EXAMPLEKEY1234567890 today.", [{ type: "API_KEY", text: "sk-live-51Hx9a2EXAMPLEKEY1234567890" }]),
  item("api-google", "en", "Maps key AIzaSyA1234567890abcdefghij1234567 should rotate.", [{ type: "API_KEY", text: "AIzaSyA1234567890abcdefghij1234567" }]),
  item("api-github", "en", "Token ghp_1234567890abcdefghijklmnopqrstuv12 leaked in the log.", [{ type: "API_KEY", text: "ghp_1234567890abcdefghijklmnopqrstuv12" }]),
  item("secret-password", "en", "password: harbor-gate-88 was reused.", [{ type: "SECRET", text: "harbor-gate-88" }]),
  item("secret-bearer", "en", "Authorization bearer abcdefghijklmnopqrstuvwxyz012345", [{ type: "SECRET", text: "abcdefghijklmnopqrstuvwxyz012345" }]),
  item("mixed-note", "en", "Customer Helen Brooks wrote from helen.brooks@example.com.", [
    { type: "PERSON", text: "Helen Brooks" },
    { type: "EMAIL", text: "helen.brooks@example.com" },
  ]),
  item("neg-invoice", "en", "Invoice 1842 is delayed by two days."),
  item("neg-version", "en", "Build 2024.11.19 shipped to region 4."),
  item("neg-price", "en", "The total is 42.50 USD before tax."),
  item("neg-time", "en", "Standup is at 09:30 in room 4."),
  item("neg-sku", "en", "SKU AB-4421 is back in stock."),
  item("neg-sentence", "en", "The baker street fair was busy, but nobody left a number."),
  item("neg-percent", "en", "Latency improved by 12 percent after the cache change."),
];
