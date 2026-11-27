import { afterEach, describe, expect, it, vi } from "vitest";
import { timeoutFetch } from "./timeout-fetch";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("timeoutFetch", () => {
  it("retries a read that hit a broken connection (25P02)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(500, { code: "25P02" })).mockResolvedValueOnce(json(200, [{ id: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const res = await timeoutFetch("https://x.test/rest/v1/teams");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { code: "57014" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await timeoutFetch("https://x.test/rest/v1/teams");
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never repeats a write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { code: "25P02" }));
    vi.stubGlobal("fetch", fetchMock);
    await timeoutFetch("https://x.test/rest/v1/rpc/save", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an ordinary error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(400, { code: "PGRST100" }));
    vi.stubGlobal("fetch", fetchMock);
    await timeoutFetch("https://x.test/rest/v1/teams");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
