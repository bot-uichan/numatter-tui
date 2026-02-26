#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import blessed from "blessed";
import { config as loadEnv } from "dotenv";
import { NumatterApiError } from "numatter-client";
import { createService } from "./services/numatter-service.js";
import { initialState } from "./state/app-state.js";
import { renderState } from "./ui/renderers.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(currentDir, "../../.env"),
  resolve(currentDir, "../../../.env"),
];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const baseUrl = process.env.NUMATTER_BASE_URL;
const token = process.env.NUMATTER_TOKEN;

if (!baseUrl || !token) {
  console.error("Missing NUMATTER_BASE_URL or NUMATTER_TOKEN. See .env.example");
  process.exit(1);
}

const service = createService(baseUrl, token);
const state = initialState();

if (!process.env.LANG?.toLowerCase().includes("utf-8") && !process.env.LC_ALL?.toLowerCase().includes("utf-8")) {
  process.env.LANG = process.env.LANG ?? "C.UTF-8";
}

const screen = blessed.screen({ smartCSR: true, fullUnicode: true, dockBorders: true, title: "numatter-tui" });
const header = blessed.box({ top: 0, left: 0, width: "100%", height: 3, tags: true, style: { fg: "white", bg: "blue" }, content: " {bold}numatter-tui{/bold} [f]timeline [h]help [q]quit" });
const body = blessed.box({ top: 3, left: 0, width: "100%", height: "100%-3", border: "line", label: " Numatter ", scrollable: true, alwaysScroll: true, keys: true, vi: true, content: "Loading..." });
screen.append(header);
screen.append(body);

const redraw = () => {
  body.setContent(renderState(state));
  screen.render();
};

const toErrorMessage = (err: unknown) => {
  if (err instanceof NumatterApiError) return `API Error (${err.status}): ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
};

const run = async (message: string, fn: () => Promise<void>) => {
  state.loading = true;
  state.message = message;
  redraw();
  try {
    await fn();
  } catch (err) {
    state.message = toErrorMessage(err);
  } finally {
    state.loading = false;
    redraw();
  }
};

const ask = (label: string): Promise<string | null> =>
  new Promise((resolve) => {
    const prompt = blessed.prompt({ parent: screen, border: "line", height: 8, width: "70%", top: "center", left: "center", label, keys: true, vi: true });
    prompt.input(label, "", (_err, value) => resolve(value ?? null));
  });

const refreshDashboard = async () => {
  await run("Loading dashboard", async () => {
    const data = await service.refreshDashboard();
    state.profile = data.profile;
    state.unreadCount = data.unreadCount;
    if (state.view !== "timeline") {
      state.view = "dashboard";
    }
    state.message = "dashboard updated";
  });
};

const loadTimeline = async (
  options?: { userId?: string; tab?: "posts" | "replies" | "media" | "likes"; keepSelection?: boolean; append?: boolean }
) => {
  await run("Loading timeline", async () => {
    const { items } = await service.client.getTimeline({
      userId: options?.userId ?? state.timelineUserId,
      tab: options?.tab ?? state.timelineTab,
      limit: state.timelineLimit,
    });
    state.timeline = items;
    state.timelineUserId = options?.userId ?? state.timelineUserId;
    state.timelineTab = options?.tab ?? state.timelineTab;
    if (!options?.keepSelection) {
      state.selectedTimelineIndex = 0;
    } else {
      state.selectedTimelineIndex = Math.min(state.selectedTimelineIndex, Math.max(items.length - 1, 0));
    }
    state.view = "timeline";
    state.message = `${options?.append ? "timeline extended" : "timeline loaded"}: ${items.length} items (limit=${state.timelineLimit})`;
  });
};

screen.key(["q", "C-c"], () => process.exit(0));
screen.key(["h"], () => {
  state.view = "help";
  redraw();
});
screen.key(["r"], () => void refreshDashboard());
screen.key(["p"], async () => {
  const content = await ask("Post content");
  if (!content) return;
  await run("Creating post", async () => {
    const { post } = await service.client.createPost({ content });
    state.view = "post";
    state.selectedPost = post;
    state.message = `post created: ${post.id}`;
  });
});
screen.key(["o"], async () => {
  const postId = await ask("Post ID");
  if (!postId) return;
  await run("Loading post", async () => {
    const { post } = await service.client.getPost(postId);
    state.view = "post";
    state.selectedPost = post;
  });
});
screen.key(["t"], async () => {
  const postId = await ask("Thread post ID");
  if (!postId) return;
  await run("Loading thread", async () => {
    state.thread = await service.client.getPostThread(postId);
    state.view = "thread";
  });
});
screen.key(["x"], async () => {
  const postId = await ask("Delete post ID");
  if (!postId) return;
  await run("Deleting post", async () => {
    await service.client.deletePost(postId);
    state.message = `deleted post: ${postId}`;
  });
});
screen.key(["l", "u", "s", "S"], async (_ch, key) => {
  const selectedPostId = state.timeline[state.selectedTimelineIndex]?.post.id;
  const useSelected = state.view === "timeline" && selectedPostId;
  const postId = useSelected ? selectedPostId : await ask(`${key.full} post ID`);
  if (!postId) return;

  await run("Updating interaction", async () => {
    const summary =
      key.full === "l"
        ? await service.client.likePost(postId)
        : key.full === "u"
          ? await service.client.unlikePost(postId)
          : key.full === "s"
            ? await service.client.repost(postId)
            : await service.client.unrepost(postId);
    state.message = `likes=${summary.likes} reposts=${summary.reposts}`;
  });
});
screen.key(["f"], async () => {
  const tabInput = await ask("Timeline tab posts/replies/media/likes (blank=default)");
  const userId = await ask("Timeline userId (blank=self/global)");
  state.timelineLimit = 50;
  await loadTimeline({
    tab: tabInput ? (tabInput as "posts" | "replies" | "media" | "likes") : undefined,
    userId: userId || undefined,
  });
});

screen.key(["j", "down"], () => {
  if (state.view !== "timeline" || state.timeline.length === 0) return;

  const atBottom = state.selectedTimelineIndex >= state.timeline.length - 1;
  if (atBottom) {
    state.timelineLimit += 50;
    void loadTimeline({ keepSelection: true, append: true });
    return;
  }

  state.selectedTimelineIndex = Math.min(state.selectedTimelineIndex + 1, state.timeline.length - 1);
  redraw();
});

screen.key(["k", "up"], () => {
  if (state.view !== "timeline" || state.timeline.length === 0) return;
  state.selectedTimelineIndex = Math.max(state.selectedTimelineIndex - 1, 0);
  redraw();
});

screen.key(["enter"], async () => {
  if (state.view !== "timeline") return;
  const postId = state.timeline[state.selectedTimelineIndex]?.post.id;
  if (!postId) return;
  await run("Loading post", async () => {
    const { post } = await service.client.getPost(postId);
    state.selectedPost = post;
    state.view = "post";
  });
});

screen.key(["U"], async () => {
  if (state.view !== "timeline") return;
  const userId = state.timeline[state.selectedTimelineIndex]?.post.author?.id;
  if (!userId) {
    state.message = "selected post has no author id";
    redraw();
    return;
  }
  state.timelineLimit = 50;
  await loadTimeline({ userId });
});

screen.key(["n", "m"], async (_ch, key) => {
  await run("Loading notifications", async () => {
    const { items, unreadCount } = await service.client.getNotifications({ type: "all", markAsRead: key.full === "m" });
    state.view = "notifications";
    state.notifications = items;
    state.unreadCount = unreadCount;
    state.message = key.full === "m" ? "marked as read" : "";
  });
});
screen.key(["d"], async () => {
  const id = await ask("Notification ID");
  if (!id) return;
  await run("Loading notification detail", async () => {
    const { notification } = await service.client.getNotification(id);
    state.selectedNotification = notification;
    state.view = "notification-detail";
  });
});
screen.key(["e"], async () => {
  const name = await ask("name (blank to skip)");
  const handle = await ask("handle (blank to skip, 'null' to clear)");
  const bio = await ask("bio (blank to skip, 'null' to clear)");
  await run("Updating profile", async () => {
    const payload: Record<string, string | null> = {};
    if (name) payload.name = name;
    if (handle) payload.handle = handle === "null" ? null : handle;
    if (bio) payload.bio = bio === "null" ? null : bio;
    const { profile } = await service.client.updateProfile(payload);
    state.profile = profile;
    state.view = "dashboard";
  });
});
screen.key(["w"], async () => {
  await run("Loading webhooks", async () => {
    const { webhooks } = await service.client.listWebhooks();
    state.webhooks = webhooks;
    state.view = "webhooks";
  });
});
screen.key(["W"], async () => {
  const name = await ask("Webhook name");
  const endpoint = await ask("Webhook endpoint");
  if (!name || !endpoint) return;
  await run("Creating webhook", async () => {
    const result = await service.client.createWebhook({ name, endpoint, isActive: true });
    state.message = `created webhook ${result.webhook.id} secret=${result.plainSecret}`;
  });
});
screen.key(["a"], async () => {
  const id = await ask("Webhook ID");
  const active = await ask("isActive true/false");
  if (!id || !active) return;
  await run("Updating webhook", async () => {
    await service.client.updateWebhook(id, { isActive: active === "true" });
    state.message = `updated webhook ${id}`;
  });
});
screen.key(["k"], async () => {
  const id = await ask("Delete webhook ID");
  if (!id) return;
  await run("Deleting webhook", async () => {
    await service.client.deleteWebhook(id);
    state.message = `deleted webhook ${id}`;
  });
});
screen.key(["g"], async () => {
  const webhookId = await ask("Webhook ID (blank=all active)");
  await run("Sending webhook snapshot", async () => {
    const res = await service.client.sendWebhook(webhookId ? { webhookId, type: "all" } : {});
    state.message = `sent ${res.results.length} deliveries`;
  });
});
screen.key(["z"], async () => {
  await run("Listing tokens", async () => {
    const { tokens } = await service.client.listTokens();
    state.tokens = tokens;
    state.view = "tokens";
  });
});
screen.key(["Z"], async () => {
  const name = await ask("Token name");
  const exp = await ask("expiresInDays (blank=default, null=non-expire)");
  if (!name) return;
  await run("Creating token", async () => {
    const expiresInDays = exp === "null" ? null : exp ? Number(exp) : undefined;
    const { token, plainToken } = await service.client.createToken({ name, expiresInDays });
    state.message = `token ${token.id} created plainToken=${plainToken}`;
  });
});
screen.key(["v"], async () => {
  const tokenId = await ask("Revoke token ID");
  if (!tokenId) return;
  await run("Revoking token", async () => {
    await service.client.revokeToken(tokenId);
    state.message = `revoked ${tokenId}`;
  });
});

void (async () => {
  await refreshDashboard();
  await loadTimeline();
})();
redraw();
