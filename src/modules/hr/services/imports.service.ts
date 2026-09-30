export interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function parseCsvPreview(content: string, limit = 20): CsvPreview {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;

    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const [headerLine, ...rowLines] = lines;

  return {
    headers: parseLine(headerLine),
    rows: rowLines.slice(0, limit).map(parseLine),
    totalRows: rowLines.length,
  };
}
