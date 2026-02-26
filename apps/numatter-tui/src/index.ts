#!/usr/bin/env node
import blessed from "blessed";
import "dotenv/config";
import { NumatterClient, NumatterApiError } from "numatter-client";

const baseUrl = process.env.NUMATTER_BASE_URL;
const token = process.env.NUMATTER_TOKEN;

if (!baseUrl || !token) {
  console.error("Missing NUMATTER_BASE_URL or NUMATTER_TOKEN. See .env.example");
  process.exit(1);
}

const client = new NumatterClient({ baseUrl, token });

const screen = blessed.screen({
  smartCSR: true,
  title: "numatter-tui",
});

const header = blessed.box({
  top: 0,
  left: 0,
  width: "100%",
  height: 3,
  tags: true,
  style: { fg: "white", bg: "blue" },
  content: " {bold}numatter-tui{/bold}  [r]refresh [p]post [n]notifications [q]quit",
});

const body = blessed.box({
  top: 3,
  left: 0,
  width: "100%",
  height: "100%-3",
  border: "line",
  label: " Dashboard ",
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  content: "Loading...",
});

screen.append(header);
screen.append(body);

function setMessage(text: string) {
  body.setContent(text);
  screen.render();
}

function toErrorMessage(err: unknown) {
  if (err instanceof NumatterApiError) {
    return `API Error (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function refreshDashboard() {
  try {
    setMessage("Loading profile + unread count...");
    const [{ profile }, unread] = await Promise.all([
      client.getProfile(),
      client.getUnreadNotificationCount(),
    ]);

    setMessage(
      [
        `{bold}${profile.name}{/bold} ${profile.handle ? `(@${profile.handle})` : ""}`,
        "",
        `${profile.bio ?? "(no bio)"}`,
        "",
        `Followers: ${profile.stats.followers}`,
        `Following: ${profile.stats.following}`,
        `Posts: ${profile.stats.posts}`,
        `Unread notifications: ${unread.count}`,
        "",
        "Tips:",
        "- Press [p] to create a new post",
        "- Press [n] to see latest notifications",
      ].join("\n")
    );
  } catch (err) {
    setMessage(`Failed to load dashboard\n\n${toErrorMessage(err)}`);
  }
}

function openPrompt(label: string, cb: (value: string) => Promise<void>) {
  const prompt = blessed.prompt({
    parent: screen,
    border: "line",
    height: 8,
    width: "70%",
    top: "center",
    left: "center",
    label,
    tags: true,
    keys: true,
    vi: true,
  });

  prompt.input(label, "", async (_err, value) => {
    if (!value) {
      screen.render();
      return;
    }

    try {
      await cb(value);
    } catch (err) {
      setMessage(`Operation failed\n\n${toErrorMessage(err)}`);
    }
  });
}

async function showNotifications() {
  try {
    setMessage("Loading notifications...");
    const { items, unreadCount } = await client.getNotifications({ type: "all" });

    const lines = [
      `{bold}Notifications{/bold} (unread: ${unreadCount})`,
      "",
    ];

    if (items.length === 0) {
      lines.push("No notifications.");
    } else {
      for (const item of items.slice(0, 20)) {
        lines.push(
          `• [${item.type}] ${item.actor?.name ?? "someone"} - ${new Date(item.createdAt).toLocaleString()}`
        );
        const content = item.sourcePost?.content;
        if (content) {
          lines.push(`  ${content}`);
        }
      }
    }

    lines.push("", "Press [r] to return dashboard.");
    setMessage(lines.join("\n"));
  } catch (err) {
    setMessage(`Failed to load notifications\n\n${toErrorMessage(err)}`);
  }
}

screen.key(["q", "C-c"], () => process.exit(0));
screen.key(["r"], () => {
  void refreshDashboard();
});
screen.key(["n"], () => {
  void showNotifications();
});
screen.key(["p"], () => {
  openPrompt("Post content", async (value) => {
    setMessage("Posting...");
    const res = await client.createPost({ content: value });
    setMessage(`Posted successfully.\nPost ID: ${res.post.id}\n\nPress [r] to refresh dashboard.`);
  });
});

void refreshDashboard();
screen.render();
