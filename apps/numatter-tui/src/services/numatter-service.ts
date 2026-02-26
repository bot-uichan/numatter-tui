import { NumatterClient } from "numatter-client";

export const createService = (baseUrl: string, token: string) => {
  const client = new NumatterClient({ baseUrl, token });
  return {
    client,
    refreshDashboard: async () => {
      const [{ profile }, unread] = await Promise.all([client.getProfile(), client.getUnreadNotificationCount()]);
      return { profile, unreadCount: unread.count };
    },
  };
};

export type NumatterService = ReturnType<typeof createService>;
