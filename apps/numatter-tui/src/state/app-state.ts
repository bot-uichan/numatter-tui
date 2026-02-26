import type { DeveloperProfile, NotificationDetail, NotificationItem, PostSummary, Webhook, DeveloperToken } from "numatter-client";

export type ViewName = "dashboard" | "notifications" | "notification-detail" | "post" | "thread" | "webhooks" | "tokens" | "help";

export type AppState = {
  view: ViewName;
  loading: boolean;
  message: string;
  profile: DeveloperProfile | null;
  unreadCount: number;
  notifications: NotificationItem[];
  selectedNotification: NotificationDetail | null;
  selectedPost: PostSummary | null;
  thread: { post: PostSummary; conversationPath: PostSummary[]; replies: PostSummary[] } | null;
  webhooks: Webhook[];
  tokens: DeveloperToken[];
};

export const initialState = (): AppState => ({
  view: "dashboard",
  loading: false,
  message: "",
  profile: null,
  unreadCount: 0,
  notifications: [],
  selectedNotification: null,
  selectedPost: null,
  thread: null,
  webhooks: [],
  tokens: [],
});

export const keyHelp: Array<{ key: string; action: string }> = [
  { key: "r", action: "refresh dashboard" },
  { key: "p", action: "create post" },
  { key: "o", action: "open post by id" },
  { key: "t", action: "open thread by post id" },
  { key: "x", action: "delete post by id" },
  { key: "l", action: "like post by id" },
  { key: "u", action: "unlike post by id" },
  { key: "s", action: "repost post by id" },
  { key: "S", action: "unrepost post by id" },
  { key: "n", action: "list notifications" },
  { key: "m", action: "list notifications + mark all read" },
  { key: "d", action: "notification detail by id" },
  { key: "e", action: "edit profile" },
  { key: "w", action: "list webhooks" },
  { key: "W", action: "create webhook" },
  { key: "a", action: "update webhook isActive" },
  { key: "k", action: "delete webhook" },
  { key: "g", action: "send webhook snapshot" },
  { key: "z", action: "list tokens" },
  { key: "Z", action: "create token" },
  { key: "v", action: "revoke token" },
  { key: "h", action: "help" },
  { key: "q", action: "quit" },
];
