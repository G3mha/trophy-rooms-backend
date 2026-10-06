import { readFileSync } from "node:fs";

export interface ReviewSheetRow<Column extends string> {
  // 1-based line in the file, header included
  line: number;
  // Lowercased and trimmed; "" when the row hasn't been decided
  decision: string;
  values: Record<Column, string>;
}

/**
 * Read a review sheet: a CSV a person marks up in its "decision" column
 * (scripts/data/*.csv). Returns every row with the named columns. A missing
 * column, or a decision that isn't blank or one of `decisions`, stops the run.
 */
export function readReviewSheet<Column extends string>(
  path: string,
  columns: readonly Column[],
  decisions: readonly string[]
): Array<ReviewSheetRow<Column>> {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8"));
  if (!header) throw new Error(`${path} is empty`);
  const indexOf = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`${path} has no "${name}" column`);
    return index;
  };
  const decisionIndex = indexOf("decision");
  const columnIndexes = columns.map((name) => [name, indexOf(name)] as const);

  return rows.map((row, index) => {
    const decision = (row[decisionIndex] ?? "").trim().toLowerCase();
    if (decision !== "" && !decisions.includes(decision)) {
      throw new Error(
        `${path} row ${index + 2}: decision must be ${decisions.join(", ")} or blank, got "${row[decisionIndex]}"`
      );
    }
    const values = Object.fromEntries(columnIndexes.map(([name, at]) => [name, row[at] ?? ""])) as Record<Column, string>;
    return { line: index + 2, decision, values };
  });
}

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}
