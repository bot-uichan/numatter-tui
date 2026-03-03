import { NumatterClient } from "numatter-client";

export const createService = (baseUrl: string, token: string, options?: { totpProvider?: () => Promise<string | null> }) => {
  const client = new NumatterClient({ baseUrl, token, totpProvider: options?.totpProvider });
  return {
    client,
    refreshDashboard: async () => {
      const [{ profile }, unread] = await Promise.all([client.getProfile(), client.getUnreadNotificationCount()]);
      return { profile, unreadCount: unread.count };
    },
  };
};

export type NumatterService = ReturnType<typeof createService>;
