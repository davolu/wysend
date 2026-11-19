/**
 * Fictional work note used by tests, the side panel sample, and the demo page.
 * Keep demo/index.html in sync with this string.
 */
export const SAMPLE_TEXT = `Hello,

Please update the file for Maya Chen. She called about invoice 1842. Her mobile is +1 415 555 0198 and her email is maya.chen@example.com. The contract address is 18 Baker Street, London.

IBAN: DE89 3704 0044 0532 0130 00
Card: 4242 4242 4242 4242
SSN: 219-09-9999

The staging key is sk-live-51Hx9a2EXAMPLEKEY1234567890

Thanks,
Luis Ortega
`;

export const SAMPLE_SECRETS = [
  "Maya Chen",
  "Luis Ortega",
  "+1 415 555 0198",
  "maya.chen@example.com",
  "18 Baker Street, London",
  "DE89 3704 0044 0532 0130 00",
  "4242 4242 4242 4242",
  "219-09-9999",
  "sk-live-51Hx9a2EXAMPLEKEY1234567890",
] as const;
