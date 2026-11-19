import { detectRules, resolveOverlaps } from "./detectors";
import { canonicalValue, emptyEnabled, ENTITY_TYPES, type EntityType } from "./types";
import { DATASET, type LabeledSample } from "./dataset";

export interface TypeScore {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
}

export interface EvalReport {
  samples: number;
  labeled: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  byType: Record<EntityType, TypeScore>;
  misses: { id: string; type: EntityType; text: string }[];
  extras: { id: string; type: EntityType; text: string }[];
}

function ratio(hit: number, total: number): number {
  if (total === 0) return 1;
  return hit / total;
}

function sameEntity(type: EntityType, predicted: string, gold: string): boolean {
  const left = canonicalValue(type, predicted);
  const right = canonicalValue(type, gold);
  if (!left || !right) return false;
  if (left === right) return true;
  if (type === "ADDRESS" || type === "PERSON" || type === "SECRET") {
    const shorter = Math.min(predicted.length, gold.length);
    const longer = Math.max(predicted.length, gold.length);
    if (shorter < 8 || shorter / longer < 0.6) return false;
    return predicted.includes(gold) || gold.includes(predicted);
  }
  return false;
}

export function scoreSamples(samples: LabeledSample[] = DATASET): EvalReport {
  const byType = {} as Record<EntityType, TypeScore>;
  for (const type of ENTITY_TYPES) {
    byType[type] = { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1 };
  }
  const misses: EvalReport["misses"] = [];
  const extras: EvalReport["extras"] = [];
  let labeled = 0;

  for (const sample of samples) {
    labeled += sample.entities.length;
    const predictions = resolveOverlaps(detectRules(sample.text, emptyEnabled()));
    const used = new Set<number>();
    for (const gold of sample.entities) {
      const index = predictions.findIndex((span, spanIndex) => (
        !used.has(spanIndex) && span.type === gold.type && sameEntity(span.type, span.value, gold.text)
      ));
      if (index >= 0) {
        used.add(index);
        byType[gold.type].tp += 1;
      } else {
        byType[gold.type].fn += 1;
        misses.push({ id: sample.id, type: gold.type, text: gold.text });
      }
    }
    predictions.forEach((span, index) => {
      if (used.has(index)) return;
      byType[span.type].fp += 1;
      extras.push({ id: sample.id, type: span.type, text: span.value });
    });
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  for (const type of ENTITY_TYPES) {
    const row = byType[type];
    truePositives += row.tp;
    falsePositives += row.fp;
    falseNegatives += row.fn;
    row.precision = ratio(row.tp, row.tp + row.fp);
    row.recall = ratio(row.tp, row.tp + row.fn);
  }

  return {
    samples: samples.length,
    labeled,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
    byType,
    misses,
    extras,
  };
}

export function formatReport(report: EvalReport): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const lines = [
    `Samples: ${report.samples}`,
    `Labeled entities: ${report.labeled}`,
    `Precision: ${pct(report.precision)} (${report.truePositives} / ${report.truePositives + report.falsePositives})`,
    `Recall: ${pct(report.recall)} (${report.truePositives} / ${report.truePositives + report.falseNegatives})`,
    "",
    "Type | Precision | Recall | TP | FP | FN",
    "---|---:|---:|---:|---:|---:",
  ];
  for (const type of ENTITY_TYPES) {
    const row = report.byType[type];
    if (row.tp + row.fp + row.fn === 0) continue;
    lines.push(`${type} | ${pct(row.precision)} | ${pct(row.recall)} | ${row.tp} | ${row.fp} | ${row.fn}`);
  }
  if (report.misses.length) {
    lines.push("", "Misses:");
    for (const miss of report.misses) lines.push(`- ${miss.id} ${miss.type} ${miss.text}`);
  }
  if (report.extras.length) {
    lines.push("", "Extras:");
    for (const extra of report.extras) lines.push(`- ${extra.id} ${extra.type} ${extra.text}`);
  }
  return lines.join("\n");
}
