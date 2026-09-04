export type PublicInboxNotification = {
  id: string;
  userId: string;
  channel: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
};
