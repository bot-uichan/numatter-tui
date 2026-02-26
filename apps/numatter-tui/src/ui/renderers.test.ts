import { describe, expect, it } from "vitest";
import { initialState } from "../state/app-state.js";
import { renderState } from "./renderers.js";

describe("renderState", () => {
  it("renders dashboard and unread", () => {
    const state = initialState();
    state.unreadCount = 4;
    state.profile = {
      id: "u",
      name: "Alice",
      handle: "alice",
      bio: "hello",
      image: null,
      bannerImage: null,
      isDeveloper: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: { followers: 1, following: 2, posts: 3 },
    };
    state.view = "dashboard";
    const view = renderState(state);
    expect(view).toContain("Alice");
    expect(view).toContain("unread notifications: 4");
  });

  it("renders help view", () => {
    const state = initialState();
    state.view = "help";
    const view = renderState(state);
    expect(view).toContain("Help");
    expect(view).toContain("refresh dashboard");
  });

  it("renders notification detail", () => {
    const state = initialState();
    state.view = "notification-detail";
    state.selectedNotification = {
      id: "n1",
      type: "like",
      sourceType: "post_like",
      sourceId: "s1",
      createdAt: new Date().toISOString(),
      readAt: null,
      title: null,
      body: null,
      actionUrl: null,
      actor: null,
      post: null,
      quotePost: null,
    };
    expect(renderState(state)).toContain("n1");
  });
});
