// src/utils/diff.ts
import type { SwitchIni, StructuredConfigChange, RawDiffLine } from "../app-types";

export function buildStructuredConfigChanges(
  originalConfig: SwitchIni | null,
  currentConfig: SwitchIni | null,
): StructuredConfigChange[] {
  if (!originalConfig || !currentConfig) {
    return [];
  }

  const changes: StructuredConfigChange[] = [];
  for (const section of currentConfig.sections_order) {
    const currentSection = currentConfig.sections[section] || {};
    const originalSection = originalConfig.sections[section] || {};
    for (const [key, entry] of Object.entries(currentSection)) {
      const previous = originalSection[key]?.value ?? "";
      if (previous !== entry.value) {
        changes.push({
          section,
          key,
          previous,
          next: entry.value,
          valueType: entry.value_type,
        });
      }
    }
  }

  return changes;
}

export function buildTextDiff(before: string, after: string): RawDiffLine[] {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const diff: RawDiffLine[] = [];

  for (let index = 0; index < max; index += 1) {
    const oldLine = beforeLines[index];
    const newLine = afterLines[index];
    if (oldLine === newLine) {
      diff.push({ kind: "same", before: oldLine, after: newLine });
    } else if (oldLine == null) {
      diff.push({ kind: "add", after: newLine });
    } else if (newLine == null) {
      diff.push({ kind: "remove", before: oldLine });
    } else {
      diff.push({ kind: "change", before: oldLine, after: newLine });
    }
  }

  return diff;
}
