import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatWindow } from "./ChatWindow";
import { createLogger } from "./logger";
import { NostrProvider } from "./NostrProvider";
import type { AgentConfig } from "./types";
import { useNostrChat } from "./useNostrChat";

const logger = createLogger("nostr-chat:widget");

interface ChatWidgetInnerProps {
  isOpen: boolean;
  onToggle: () => void;
  agents: AgentConfig[];
}

function ChatWidgetInner({ isOpen, onToggle, agents }: ChatWidgetInnerProps) {
  const {
    messages,
    sendMessage,
    isSending,
    connectionStatus,
    connect,
    agentProfiles,
  } = useNostrChat(agents);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCount = useRef(messages.length);

  // Lazy connect on first open
  useEffect(() => {
    logger.debug("isOpen:", isOpen, "connectionStatus:", connectionStatus);
    if (isOpen && connectionStatus === "disconnected") {
      logger.info("Chat opened, triggering connect...");
      connect();
    }
  }, [isOpen, connectionStatus, connect]);

  // Track unread when chat is closed
  useEffect(() => {
    if (!isOpen && messages.length > prevMessageCount.current) {
      const newMessages = messages.slice(prevMessageCount.current);
      const incomingCount = newMessages.filter(
        (m) => m.direction === "received",
      ).length;
      setUnreadCount((prev) => prev + incomingCount);
    }
    prevMessageCount.current = messages.length;
  }, [messages, isOpen]);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setUnreadCount(0);
    }
    onToggle();
  }, [isOpen, onToggle]);

  if (isOpen) {
    return (
      <ChatWindow
        messages={messages}
        connectionStatus={connectionStatus}
        isSending={isSending}
        onSend={sendMessage}
        onClose={handleToggle}
        agentProfiles={agentProfiles}
      />
    );
  }

  return <ChatBubble onClick={handleToggle} unreadCount={unreadCount} />;
}

export interface ChatWidgetProps {
  privateKeyHex?: string;
  relays?: string[];
  /** Agent configurations — at least one agent is required. */
  agents: AgentConfig[];
}

export function ChatWidget({ privateKeyHex, relays, agents }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return (
    <NostrProvider privateKeyHex={privateKeyHex} relays={relays}>
      <ChatWidgetInner isOpen={isOpen} onToggle={toggle} agents={agents} />
    </NostrProvider>
  );
}
