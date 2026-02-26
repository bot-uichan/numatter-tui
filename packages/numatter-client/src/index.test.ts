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
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { profile: {} } }));
    const client = new NumatterClient({ baseUrl: "https://example.com///", token: "secret_token", fetch: fetchMock as unknown as typeof fetch });

    await client.getProfile();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/api/developer/v1/profile");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer secret_token");
  });

  it("sends JSON for updateProfile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { profile: {} } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await client.updateProfile({ name: "bob" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("sends FormData for createPost with reply/quote", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { post: { id: "p1", content: "x", createdAt: new Date().toISOString() } } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });

    await client.createPost({ content: "hello", replyToPostId: "root" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get("content")).toBe("hello");
    expect(form.get("replyToPostId")).toBe("root");
  });

  it("builds notification query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { items: [], unreadCount: 0 } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });

    await client.getNotifications({ type: "mention", markAsRead: true });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("type=mention");
    expect(url).toContain("markAsRead=true");
  });

  it("calls thread endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { post: {}, conversationPath: [], replies: [] } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await client.getPostThread("abc");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/api/developer/v1/posts/abc/thread");
  });

  it("calls likes/reposts endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ json: { postId: "p", liked: true, reposted: false, likes: 1, reposts: 0 } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });

    await client.likePost("p");
    await client.unlikePost("p");
    await client.repost("p");
    await client.unrepost("p");

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "https://example.com/api/developer/v1/posts/p/likes",
      "https://example.com/api/developer/v1/posts/p/likes",
      "https://example.com/api/developer/v1/posts/p/reposts",
      "https://example.com/api/developer/v1/posts/p/reposts",
    ]);
  });

  it("calls webhook CRUD + send endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ json: { webhooks: [] } }))
      .mockResolvedValueOnce(mockResponse({ json: { webhook: { id: "w" }, plainSecret: "s" } }))
      .mockResolvedValueOnce(mockResponse({ json: { webhook: { id: "w" }, plainSecret: null } }))
      .mockResolvedValueOnce(mockResponse({ json: { deleted: true } }))
      .mockResolvedValueOnce(mockResponse({ json: { deliveredAt: "", unreadCount: 0, itemCount: 0, results: [] } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });

    await client.listWebhooks();
    await client.createWebhook({ name: "main", endpoint: "https://a" });
    await client.updateWebhook("w", { isActive: false });
    await client.deleteWebhook("w");
    await client.sendWebhook({ webhookId: "w", type: "all" });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://example.com/api/developer/v1/notifications/webhooks",
      "https://example.com/api/developer/v1/notifications/webhooks",
      "https://example.com/api/developer/v1/notifications/webhooks/w",
      "https://example.com/api/developer/v1/notifications/webhooks/w",
      "https://example.com/api/developer/v1/notifications/webhooks/send",
    ]);
  });

  it("calls token management endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ json: { tokens: [] } }))
      .mockResolvedValueOnce(mockResponse({ json: { token: { id: "t" }, plainToken: "nmt_dev_x" } }))
      .mockResolvedValueOnce(mockResponse({ json: { token: { id: "t" } } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });

    await client.listTokens();
    await client.createToken({ name: "cli", expiresInDays: 30 });
    await client.revokeToken("tok-1");

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://example.com/api/developer/tokens",
      "https://example.com/api/developer/tokens",
      "https://example.com/api/developer/tokens/tok-1",
    ]);
  });

  it("throws NumatterApiError with API message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ status: 401, json: { error: "Invalid developer API token" } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "bad", fetch: fetchMock as unknown as typeof fetch });
    await expect(client.getProfile()).rejects.toEqual(expect.objectContaining({ name: "NumatterApiError", status: 401, message: "Invalid developer API token" }));
  });

  it("falls back to generic error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ status: 500, json: { detail: "unexpected" } }));
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await expect(client.getUnreadNotificationCount()).rejects.toEqual(expect.objectContaining({ name: "NumatterApiError", status: 500 }));
  });

  it("handles invalid JSON error body", async () => {
    const response = { ok: false, status: 503, json: vi.fn().mockRejectedValue(new Error("bad json")) } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = new NumatterClient({ baseUrl: "https://example.com", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await expect(client.getProfile()).rejects.toBeInstanceOf(NumatterApiError);
  });
});
