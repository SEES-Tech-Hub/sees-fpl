import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, normaliseHeader, parseCsv, readTable } from "./parse";

const fields = (input: string) => {
  const result = parseCsv(input);
  if (!result.ok) throw new Error(result.message);
  return result.records.map((r) => r.fields);
};

describe("parseCsv", () => {
  it("parses simple rows with LF, CRLF and CR endings", () => {
    expect(fields("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(fields("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(fields("a,b\r1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(fields("﻿full_name,year\nAyo,2")[0]).toEqual(["full_name", "year"]);
  });

  it("handles quoted fields with commas, doubled quotes and newlines", () => {
    expect(fields('name,note\n"Cosy, Henry","He said ""hi""\nthen left"\n')).toEqual([
      ["name", "note"],
      ["Cosy, Henry", 'He said "hi"\nthen left'],
    ]);
  });

  it("counts a quoted newline as one spreadsheet row", () => {
    const result = parseCsv('a\n"x\ny"\nz');
    expect(result.ok && result.records.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
  });

  it("skips blank lines but keeps spreadsheet row numbers", () => {
    const result = parseCsv("a,b\n\n1,2\n,\n3,4");
    expect(result.ok && result.records.map((r) => [r.rowNumber, r.fields])).toEqual([
      [1, ["a", "b"]],
      [3, ["1", "2"]],
      [5, ["3", "4"]],
    ]);
  });

  it("keeps empty fields", () => {
    expect(fields("a,,c\n,,")).toEqual([["a", "", "c"]]);
    expect(fields('a,"",c')).toEqual([["a", "", "c"]]);
  });

  it("reports an unclosed quote with its row", () => {
    expect(parseCsv('a\n"open')).toEqual({ ok: false, message: "Row 2: a quoted value is never closed" });
  });

  it("reports a stray quote in the middle of a value", () => {
    const result = parseCsv('a\nO"Neil');
    expect(result.ok).toBe(false);
  });

  it("reports text after a closing quote", () => {
    expect(parseCsv('a\n"x"y').ok).toBe(false);
  });
});

describe("readTable", () => {
  const spec = { required: ["full_name", "year"], optional: ["status"] } as const;

  it("matches headers case-insensitively and trims values", () => {
    const result = readTable(" Full Name , YEAR \n  Ayo  , 2 ", spec);
    expect(result.ok && result.rows).toEqual([{ rowNumber: 2, values: { full_name: "Ayo", year: "2", status: "" } }]);
  });

  it("normalises header spelling", () => {
    expect(normaliseHeader(" Full-Name ")).toBe("full_name");
  });

  it("refuses unknown columns instead of ignoring them", () => {
    const result = readTable("full_name,year,colour\nAyo,2,red", spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('Unknown column "colour"');
  });

  it("refuses missing and duplicate columns", () => {
    const missing = readTable("full_name\nAyo", spec);
    expect(!missing.ok && missing.errors).toEqual(['Missing column "year"']);
    const duplicate = readTable("full_name,year,Year\nAyo,2,3", spec);
    expect(!duplicate.ok && duplicate.errors).toEqual(['The column "year" appears twice']);
  });

  it("refuses empty files and header-only files", () => {
    expect(readTable("", spec)).toEqual({ ok: false, errors: ["The file is empty"] });
    expect(readTable("﻿\r\n\r\n", spec)).toEqual({ ok: false, errors: ["The file is empty"] });
    expect(readTable("full_name,year\n", spec)).toEqual({ ok: false, errors: ["The file has a header but no rows"] });
  });

  it("accepts Excel's trailing empty columns", () => {
    const result = readTable("full_name,year,,\nAyo,2,,", spec);
    expect(result.ok && result.rows.length).toBe(1);
    expect(result.ok && result.rowErrors.size).toBe(0);
  });

  it("reports values with no heading as a row error", () => {
    const result = readTable("full_name,year\nAyo,2,extra", spec);
    expect(result.ok && result.rowErrors.get(2)?.[0]).toContain('"extra"');
  });

  it("fills missing trailing cells with empty strings", () => {
    const result = readTable("full_name,year,status\nAyo,2", spec);
    expect(result.ok && result.rows[0].values.status).toBe("");
  });

  it("caps the number of rows", () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `P${i},1`).join("\n");
    const result = readTable(`full_name,year\n${body}`, spec);
    expect(result.ok).toBe(false);
  });
});
