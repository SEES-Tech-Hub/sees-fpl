// RFC 4180 CSV parsing, plus header mapping for the admin importers.
//
// Handles what spreadsheets actually export: a UTF-8 BOM, CRLF, LF or CR line
// endings, quoted fields with embedded commas, quotes ("") and newlines, blank
// lines, and trailing empty columns from Excel.
//
// Row numbers match the spreadsheet: the header is row 1. A quoted field with
// a newline is still one spreadsheet row, so it counts once.

export type CsvRecord = { rowNumber: number; fields: string[] };

export type CsvParseResult = { ok: true; records: CsvRecord[] } | { ok: false; message: string };

/** Upper bound on rows per import; our largest real file is about 110 rows. */
export const MAX_IMPORT_ROWS = 1000;

export function parseCsv(input: string): CsvParseResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let rowNumber = 1;
  let i = 0;

  const endField = () => {
    fields.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push({ rowNumber, fields });
    fields = [];
    rowNumber += 1;
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      if (field.trim() !== "" || fieldWasQuoted) {
        return { ok: false, message: `Row ${rowNumber}: a quote (") appears in the middle of a value. Wrap the whole value in quotes and double any quotes inside it` };
      }
      field = "";
      inQuotes = true;
      fieldWasQuoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (fieldWasQuoted) {
      if (ch === " " || ch === "\t") {
        i += 1;
        continue;
      }
      return { ok: false, message: `Row ${rowNumber}: there's text after a closing quote` };
    }
    field += ch;
    i += 1;
  }

  if (inQuotes) {
    return { ok: false, message: `Row ${rowNumber}: a quoted value is never closed` };
  }
  // The last line has no newline after it.
  if (field !== "" || fields.length > 0 || fieldWasQuoted) endRecord();

  return { ok: true, records: records.filter((r) => !isBlank(r.fields)) };
}

function isBlank(fields: string[]): boolean {
  return fields.every((f) => f.trim() === "");
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

export type ColumnSpec<C extends string> = {
  required: readonly C[];
  optional: readonly C[];
};

export type TableRow<C extends string> = {
  rowNumber: number;
  /** Every known column; missing optional columns and missing trailing cells are "". Values are trimmed. */
  values: Record<C, string>;
};

export type TableResult<C extends string> =
  | { ok: true; columns: C[]; rows: TableRow<C>[]; rowErrors: Map<number, string[]> }
  | { ok: false; errors: string[] };

/** "Full name", " FULL_NAME ", "full-name" all become "full_name". */
export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Parses a CSV and maps its header to known columns. Header names are
 * case-insensitive and trimmed. Unknown, duplicate or missing required
 * columns are file errors. A row with more values than columns is a row error.
 */
export function readTable<C extends string>(input: string, spec: ColumnSpec<C>): TableResult<C> {
  const parsed = parseCsv(input);
  if (!parsed.ok) return { ok: false, errors: [parsed.message] };
  if (parsed.records.length === 0) return { ok: false, errors: ["The file is empty"] };

  const [header, ...data] = parsed.records;
  const known = new Set<string>([...spec.required, ...spec.optional]);
  const errors: string[] = [];
  const columnAt: (C | null)[] = [];
  const seen = new Set<string>();

  header.fields.forEach((raw, index) => {
    const name = normaliseHeader(raw);
    if (name === "") {
      // An empty header over an empty column (Excel's trailing commas) is fine;
      // over data it's reported per row below.
      columnAt.push(null);
      return;
    }
    if (!known.has(name)) {
      errors.push(`Unknown column "${raw.trim()}" (column ${index + 1}). Allowed columns: ${[...known].join(", ")}`);
      columnAt.push(null);
      return;
    }
    if (seen.has(name)) {
      errors.push(`The column "${name}" appears twice`);
      columnAt.push(null);
      return;
    }
    seen.add(name);
    columnAt.push(name as C);
  });

  for (const column of spec.required) {
    if (!seen.has(column)) errors.push(`Missing column "${column}"`);
  }
  if (errors.length > 0) return { ok: false, errors };
  if (data.length === 0) return { ok: false, errors: ["The file has a header but no rows"] };
  if (data.length > MAX_IMPORT_ROWS) {
    return { ok: false, errors: [`The file has ${data.length} rows; the most one import takes is ${MAX_IMPORT_ROWS}`] };
  }

  const columns = columnAt.filter((c): c is C => c !== null);
  const rowErrors = new Map<number, string[]>();
  const rows = data.map((record) => {
    const values = Object.fromEntries([...known].map((c) => [c, ""])) as Record<C, string>;
    record.fields.forEach((value, index) => {
      const column = index < columnAt.length ? columnAt[index] : null;
      if (column) {
        values[column] = value.trim();
      } else if (value.trim() !== "") {
        const list = rowErrors.get(record.rowNumber) ?? [];
        list.push(`Row ${record.rowNumber}: value "${value.trim()}" in column ${index + 1} has no column heading`);
        rowErrors.set(record.rowNumber, list);
      }
    });
    return { rowNumber: record.rowNumber, values };
  });

  return { ok: true, columns, rows, rowErrors };
}
