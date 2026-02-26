import { describe, expect, it, vi } from "vitest";
import { NumatterApiError, NumatterClient } from "./index";

type MockResponseInit = {
  status?: number;
  json?: unknown;
};

const mockResponse = ({ status = 200, json = {} }: MockResponseInit): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(json),
  } as unknown as Response;
};

describe("NumatterClient", () => {
  it("normalizes baseUrl and sends Bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        json: {
          profile: {
            id: "u1",
            name: "alice",
            handle: "alice",
            bio: null,
            image: null,
            bannerImage: null,
            isDeveloper: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: { followers: 1, following: 2, posts: 3 },
          },
        },
      })
    );

    const client = new NumatterClient({
      baseUrl: "https://example.com///",
      token: "secret_token",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.getProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/api/developer/v1/profile");
    expect(init.method).toBe("GET");
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer secret_token");
  });

  it("sends JSON for updateProfile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { profile: {} } }));
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.updateProfile({ name: "bob" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "bob" }));
  });

  it("sends FormData for createPost", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { post: { id: "p1", content: "x", createdAt: new Date().toISOString() } } }));
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.createPost({ content: "hello" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("content")).toBe("hello");
  });

  it("builds notification query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { items: [], unreadCount: 0 } }));
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.getNotifications({ type: "mention", markAsRead: true });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/developer/v1/notifications?");
    expect(url).toContain("type=mention");
    expect(url).toContain("markAsRead=true");
  });

  it("throws NumatterApiError with API message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ status: 401, json: { error: "Invalid developer API token" } })
    );
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "bad",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getProfile()).rejects.toEqual(
      expect.objectContaining({
        name: "NumatterApiError",
        status: 401,
        message: "Invalid developer API token",
      })
    );
  });

  it("falls back to generic error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ status: 500, json: { detail: "unexpected" } })
    );
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getUnreadNotificationCount()).rejects.toEqual(
      expect.objectContaining({
        name: "NumatterApiError",
        status: 500,
        message: "Numatter API request failed (500)",
      })
    );
  });

  it("handles invalid JSON error body", async () => {
    const response = {
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = new NumatterClient({
      baseUrl: "https://example.com",
      token: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getProfile()).rejects.toBeInstanceOf(NumatterApiError);
  });
});
