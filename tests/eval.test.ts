import { describe, expect, it } from "vitest";
import { DATASET } from "../src/lib/redaction/dataset";
import { formatReport, scoreSamples } from "../src/lib/redaction/evaluate";

describe("detection eval", () => {
  it("scores about 50 synthetic samples with strong precision and recall", () => {
    expect(DATASET.length).toBeGreaterThanOrEqual(50);
    const languages = new Set(DATASET.map((sample) => sample.lang));
    expect(languages.size).toBeGreaterThanOrEqual(4);
    const report = scoreSamples(DATASET);
    // Printed so `npm run eval` shows the table that the README records.
    console.log(formatReport(report));
    expect(report.precision).toBeGreaterThanOrEqual(0.9);
    expect(report.recall).toBeGreaterThanOrEqual(0.9);
    expect(report.falseNegatives).toBe(0);
  });
});
