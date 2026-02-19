export type MessageStatus = "sending" | "sent" | "failed";
export type MessageDirection = "sent" | "received";

export interface ChatMessage {
  id: string;
  content: string;
  direction: MessageDirection;
  timestamp: number;
  status: MessageStatus;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
