import type { AppState } from "../state/app-state.js";
import { keyHelp } from "../state/app-state.js";

const line = "─".repeat(70);

export const renderState = (state: AppState): string => {
  if (state.loading) return `Loading...\n\n${state.message}`;

  switch (state.view) {
    case "dashboard":
      return renderDashboard(state);
    case "timeline":
      return [
        `Timeline ${state.timelineTab ? `[${state.timelineTab}]` : ""} ${state.timelineUserId ? `(user:${state.timelineUserId})` : ""}`,
        line,
        ...(state.timeline.length === 0
          ? ["No timeline items"]
          : state.timeline.slice(0, 50).map((item, index) => {
              const prefix = index === state.selectedTimelineIndex ? "▶" : " ";
              const author = item.post.author?.handle ?? item.post.author?.name ?? "unknown";
              const content = (item.post.content ?? "").replaceAll("\n", " ");
              return `${prefix} ${item.id} @${author}: ${content}`;
            })),
        "",
        "j/k or ↑/↓: select  Enter: open  l: like  s: repost  u: user timeline",
      ].join("\n");
    case "notifications":
      return [
        "Notifications",
        line,
        `Unread: ${state.unreadCount}`,
        "",
        ...(state.notifications.length === 0
          ? ["No notifications"]
          : state.notifications.slice(0, 30).map((item) => `• ${item.id} [${item.type}] ${new Date(item.createdAt).toLocaleString()}`)),
      ].join("\n");
    case "notification-detail":
      return state.selectedNotification
        ? [
            "Notification Detail",
            line,
            `id: ${state.selectedNotification.id}`,
            `type: ${state.selectedNotification.type}`,
            `createdAt: ${state.selectedNotification.createdAt}`,
            `readAt: ${state.selectedNotification.readAt ?? "(unread)"}`,
            `title: ${state.selectedNotification.title ?? ""}`,
            `body: ${state.selectedNotification.body ?? ""}`,
          ].join("\n")
        : "No notification selected";
    case "post":
      return state.selectedPost
        ? ["Post", line, `id: ${state.selectedPost.id}`, `content: ${state.selectedPost.content ?? ""}`, `createdAt: ${state.selectedPost.createdAt}`].join("\n")
        : "No post selected";
    case "thread":
      return state.thread
        ? [
            "Thread",
            line,
            `Target: ${state.thread.post.id}`,
            `Ancestors: ${state.thread.conversationPath.length}`,
            ...state.thread.conversationPath.map((p) => `↳ ${p.id} ${p.content ?? ""}`),
            "",
            `Replies: ${state.thread.replies.length}`,
            ...state.thread.replies.map((p) => `• ${p.id} ${p.content ?? ""}`),
          ].join("\n")
        : "No thread selected";
    case "webhooks":
      return [
        "Webhooks",
        line,
        ...(state.webhooks.length === 0
          ? ["No webhooks"]
          : state.webhooks.map((w) => `${w.id} ${w.isActive ? "[active]" : "[inactive]"} ${w.name} -> ${w.endpoint}`)),
      ].join("\n");
    case "tokens":
      return [
        "Developer Tokens (session-auth endpoints)",
        line,
        ...(state.tokens.length === 0 ? ["No tokens or unauthorized for bearer token"] : state.tokens.map((t) => `${t.id} ${t.name} ${t.tokenPrefix} revoked=${t.revokedAt ? "yes" : "no"}`)),
      ].join("\n");
    case "help":
      return ["Help", line, ...keyHelp.map((h) => `${h.key.padEnd(2)} ${h.action}`)].join("\n");
    default:
      return "Unknown view";
  }
};

const renderDashboard = (state: AppState): string => {
  const p = state.profile;
  return [
    "numatter-tui dashboard",
    line,
    p ? `${p.name} ${p.handle ? `(@${p.handle})` : ""}` : "Profile not loaded",
    p?.bio ?? "",
    "",
    p ? `followers:${p.stats.followers} following:${p.stats.following} posts:${p.stats.posts}` : "",
    `unread notifications: ${state.unreadCount}`,
    "",
    state.message ? `message: ${state.message}` : "",
    "Press [h] for key help",
  ].join("\n");
};
