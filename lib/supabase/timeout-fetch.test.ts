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

  it("gives up after one retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { code: "25P02" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await timeoutFetch("https://x.test/rest/v1/teams");
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an overloaded database (timeouts, 503, 504)", async () => {
    for (const res of [json(500, { code: "57014" }), json(503, {}), json(504, {})]) {
      const fetchMock = vi.fn().mockResolvedValue(res);
      vi.stubGlobal("fetch", fetchMock);
      await timeoutFetch("https://x.test/rest/v1/teams");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
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
