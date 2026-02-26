export type ApiErrorResponse = { error?: string; message?: string };

export type NotificationFilter =
  | "all"
  | "like"
  | "repost"
  | "follow"
  | "reply"
  | "quote"
  | "mention"
  | "info"
  | "system"
  | "violation";

export type NumatterClientOptions = {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
};

export type TimelineTab = "posts" | "replies" | "media" | "likes";

export type TimelineItem = {
  id: string;
  post: PostSummary;
  actor?: { id: string; name: string; handle: string | null };
  type?: string;
  createdAt: string;
};

export type DeveloperProfile = {
  id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  image: string | null;
  bannerImage: string | null;
  isDeveloper: boolean;
  createdAt: string;
  updatedAt: string;
  stats: { followers: number; following: number; posts: number };
};

export type PostSummary = {
  id: string;
  content: string | null;
  createdAt: string;
  author?: { id: string; name: string; handle: string | null };
  interaction?: InteractionSummary;
};

export type InteractionSummary = {
  postId: string;
  liked: boolean;
  reposted: boolean;
  likes: number;
  reposts: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  actors?: Array<{ id: string; name: string; handle: string | null }>;
  actorCount?: number;
  post?: PostSummary | null;
  quotePost?: PostSummary | null;
  title?: string | null;
  body?: string | null;
  actionUrl?: string | null;
};

export type NotificationDetail = {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  readAt: string | null;
  title: string | null;
  body: string | null;
  actionUrl: string | null;
  actor: { id: string; name: string; handle: string | null; image: string | null } | null;
  post: PostSummary | null;
  quotePost: PostSummary | null;
};

export type Webhook = {
  id: string;
  name: string;
  endpoint: string;
  isActive: boolean;
  lastSentAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export class NumatterApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "NumatterApiError";
    this.status = status;
    this.data = data;
  }
}

export class NumatterClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NumatterClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
  }

  getProfile(): Promise<{ profile: DeveloperProfile }> {
    return this.request("GET", "/v1/profile");
  }

  updateProfile(input: Partial<Pick<DeveloperProfile, "name" | "handle" | "bio">>): Promise<{ profile: DeveloperProfile }> {
    return this.request("PATCH", "/v1/profile", { json: input });
  }

  createPost(input: { content?: string; replyToPostId?: string; quotePostId?: string; images?: File[] }): Promise<{ post: PostSummary }> {
    const form = new FormData();
    if (input.content !== undefined) form.append("content", input.content);
    if (input.replyToPostId) form.append("replyToPostId", input.replyToPostId);
    if (input.quotePostId) form.append("quotePostId", input.quotePostId);
    for (const image of input.images ?? []) form.append("images", image);
    return this.request("POST", "/v1/posts", { formData: form });
  }

  getPost(postId: string): Promise<{ post: PostSummary }> {
    return this.request("GET", `/v1/posts/${encodeURIComponent(postId)}`);
  }

  getPostThread(postId: string): Promise<{ post: PostSummary; conversationPath: PostSummary[]; replies: PostSummary[] }> {
    return this.request("GET", `/v1/posts/${encodeURIComponent(postId)}/thread`);
  }

  deletePost(postId: string): Promise<void> {
    return this.request("DELETE", `/v1/posts/${encodeURIComponent(postId)}`);
  }

  likePost(postId: string): Promise<InteractionSummary> {
    return this.request("POST", `/v1/posts/${encodeURIComponent(postId)}/likes`);
  }

  unlikePost(postId: string): Promise<InteractionSummary> {
    return this.request("DELETE", `/v1/posts/${encodeURIComponent(postId)}/likes`);
  }

  repost(postId: string): Promise<InteractionSummary> {
    return this.request("POST", `/v1/posts/${encodeURIComponent(postId)}/reposts`);
  }

  unrepost(postId: string): Promise<InteractionSummary> {
    return this.request("DELETE", `/v1/posts/${encodeURIComponent(postId)}/reposts`);
  }

  getTimeline(input?: { userId?: string; tab?: TimelineTab; limit?: number }): Promise<{ items: TimelineItem[] }> {
    const params = new URLSearchParams();
    if (input?.userId) params.set("userId", input.userId);
    if (input?.tab) params.set("tab", input.tab);
    if (input?.limit) params.set("limit", String(input.limit));
    const query = params.toString();
    return this.requestPublic("GET", `/api/posts${query ? `?${query}` : ""}`);
  }

  getNotifications(input?: { type?: NotificationFilter; markAsRead?: boolean }): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const params = new URLSearchParams();
    if (input?.type) params.set("type", input.type);
    if (input?.markAsRead !== undefined) params.set("markAsRead", String(input.markAsRead));
    const query = params.toString();
    return this.request("GET", `/v1/notifications${query ? `?${query}` : ""}`);
  }

  getNotification(notificationId: string): Promise<{ notification: NotificationDetail }> {
    return this.request("GET", `/v1/notifications/${encodeURIComponent(notificationId)}`);
  }

  getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.request("GET", "/v1/notifications/unread-count");
  }

  listWebhooks(): Promise<{ webhooks: Webhook[] }> {
    return this.request("GET", "/v1/notifications/webhooks");
  }

  createWebhook(input: { name: string; endpoint: string; isActive?: boolean; secret?: string }): Promise<{ webhook: Webhook; plainSecret: string }> {
    return this.request("POST", "/v1/notifications/webhooks", { json: input });
  }

  updateWebhook(webhookId: string, input: { name?: string; endpoint?: string; isActive?: boolean; secret?: string; rotateSecret?: boolean }): Promise<{ webhook: Webhook; plainSecret: string | null }> {
    return this.request("PATCH", `/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, { json: input });
  }

  deleteWebhook(webhookId: string): Promise<{ deleted: boolean }> {
    return this.request("DELETE", `/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`);
  }

  sendWebhook(input: { webhookId?: string; endpoint?: string; secret?: string; type?: NotificationFilter }): Promise<{ deliveredAt: string; unreadCount: number; itemCount: number; results: Array<{ status: string; statusCode?: number; error?: string }> }> {
    return this.request("POST", "/v1/notifications/webhooks/send", { json: input });
  }

  listTokens(): Promise<{ tokens: DeveloperToken[] }> {
    return this.request("GET", "/tokens");
  }

  createToken(input: { name: string; expiresInDays?: number | null }): Promise<{ token: DeveloperToken; plainToken: string }> {
    return this.request("POST", "/tokens", { json: input });
  }

  revokeToken(tokenId: string): Promise<{ token: DeveloperToken }> {
    return this.request("DELETE", `/tokens/${encodeURIComponent(tokenId)}`);
  }

  private async requestPublic<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options?: { json?: unknown; formData?: FormData }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let body: BodyInit | undefined;
    let headers: HeadersInit | undefined;
    if (options?.formData) {
      body = options.formData;
    } else if (options?.json !== undefined) {
      headers = { "content-type": "application/json" };
      body = JSON.stringify(options.json);
    }

    const res = await this.fetchImpl(url, { method, headers, body });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        (("error" in data && typeof (data as ApiErrorResponse).error === "string" && (data as ApiErrorResponse).error) ||
          ("message" in data && typeof (data as ApiErrorResponse).message === "string" && (data as ApiErrorResponse).message))
          ? ((data as ApiErrorResponse).error ?? (data as ApiErrorResponse).message) as string
          : `Numatter API request failed (${res.status})`;
      throw new NumatterApiError(message, res.status, data);
    }

    return data as T;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options?: { json?: unknown; formData?: FormData }
  ): Promise<T> {
    const url = `${this.baseUrl}/api/developer${path}`;
    const headers = new Headers({ Authorization: `Bearer ${this.token}` });

    let body: BodyInit | undefined;
    if (options?.formData) {
      body = options.formData;
    } else if (options?.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.json);
    }

    const res = await this.fetchImpl(url, { method, headers, body });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        (("error" in data && typeof (data as ApiErrorResponse).error === "string" && (data as ApiErrorResponse).error) ||
          ("message" in data && typeof (data as ApiErrorResponse).message === "string" && (data as ApiErrorResponse).message))
          ? ((data as ApiErrorResponse).error ?? (data as ApiErrorResponse).message) as string
          : `Numatter API request failed (${res.status})`;
      throw new NumatterApiError(message, res.status, data);
    }

    return data as T;
  }
}
