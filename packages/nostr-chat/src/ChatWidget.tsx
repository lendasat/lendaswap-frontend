import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatWindow } from "./ChatWindow";
import { NostrProvider } from "./NostrProvider";
import { useNostrChat } from "./useNostrChat";

const log = (...args: unknown[]) => console.log("[nostr-chat:widget]", ...args);

interface ChatWidgetInnerProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ChatWidgetInner({ isOpen, onToggle }: ChatWidgetInnerProps) {
  const {
    messages,
    sendMessage,
    isSending,
    connectionStatus,
    connect,
    supportProfile,
  } = useNostrChat();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCount = useRef(messages.length);

  // Lazy connect on first open
  useEffect(() => {
    log("isOpen:", isOpen, "connectionStatus:", connectionStatus);
    if (isOpen && connectionStatus === "disconnected") {
      log("Chat opened, triggering connect...");
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
        supportProfile={supportProfile}
      />
    );
  }

  return <ChatBubble onClick={handleToggle} unreadCount={unreadCount} />;
}

export interface ChatWidgetProps {
  privateKeyHex?: string;
  relays?: string[];
}

export function ChatWidget({ privateKeyHex, relays }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return (
    <NostrProvider privateKeyHex={privateKeyHex} relays={relays}>
      <ChatWidgetInner isOpen={isOpen} onToggle={toggle} />
    </NostrProvider>
  );
}
