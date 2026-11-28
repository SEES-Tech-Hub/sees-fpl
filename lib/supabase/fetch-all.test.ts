import { describe, expect, it } from "vitest";
import { fetchAll, PAGE_SIZE } from "./fetch-all";

const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

function source(rows: { id: number }[]) {
  const calls: [number, number][] = [];
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { page, calls };
}

describe("fetchAll", () => {
  it("reads past the 1,000-row cap (2,130 picks: 142 managers × 15)", async () => {
    const { page, calls } = source(table(2130));
    const { data, error } = await fetchAll(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(2130);
    expect(data.at(-1)).toEqual({ id: 2129 });
    expect(calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, 2 * PAGE_SIZE - 1],
      [2 * PAGE_SIZE, 3 * PAGE_SIZE - 1],
    ]);
  });

  it("asks once more when a page is exactly full", async () => {
    const { page, calls } = source(table(PAGE_SIZE));
    expect((await fetchAll(page)).data).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("stops at the first error and says so", async () => {
    const { data, error } = await fetchAll(() => Promise.resolve({ data: null, error: { message: "timeout" } }));
    expect(data).toEqual([]);
    expect(error?.message).toBe("timeout");
  });
});
