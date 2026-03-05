import { Loader2, Send, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { cn } from "#/lib/utils";
import { ChatMessage } from "./ChatMessage";
import type {
  AgentProfile,
  ChatMessage as ChatMessageType,
  ConnectionStatus,
} from "./types";

interface ChatWindowProps {
  messages: ChatMessageType[];
  connectionStatus: ConnectionStatus;
  isSending: boolean;
  onSend: (content: string) => void;
  onClose: () => void;
  agentProfiles: Map<string, AgentProfile>;
  draftMessage?: string;
  onDraftConsumed?: () => void;
}

export function ChatWindow({
  messages,
  connectionStatus,
  isSending,
  onSend,
  onClose,
  agentProfiles,
  draftMessage,
  onDraftConsumed,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill input from draft message
  useEffect(() => {
    if (draftMessage) {
      setInput(draftMessage);
      onDraftConsumed?.();
      // Resize textarea to fit content
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          el.focus();
        }
      });
    }
  }, [draftMessage, onDraftConsumed]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages]);

  // Focus textarea when window opens
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || connectionStatus !== "connected") return;
    onSend(input);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const statusDot = {
    disconnected: "bg-gray-400",
    connecting: "bg-yellow-400 animate-pulse",
    connected: "bg-green-400",
  };

  const profilesArray = Array.from(agentProfiles.values());
  const isSingleAgent = profilesArray.length <= 1;
  const headerName = isSingleAgent
    ? profilesArray[0]?.name || "Support"
    : "Support Team";

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex flex-col",
        "w-[380px] h-[520px]",
        "max-sm:w-[calc(100vw-2rem)] max-sm:h-[calc(100vh-6rem)]",
        "rounded-2xl border border-border bg-card shadow-xl",
        "animate-slide-in",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Stacked avatars (max 3) */}
          <div className="flex -space-x-2">
            {profilesArray
              .slice(0, 3)
              .map((profile, i) =>
                profile.picture ? (
                  <img
                    key={profile.pubkeyHex}
                    src={profile.picture}
                    alt={profile.name || "Agent"}
                    className="h-8 w-8 rounded-full object-cover border-2 border-card"
                    style={{ zIndex: 3 - i }}
                  />
                ) : (
                  <div
                    key={profile.pubkeyHex}
                    className="h-8 w-8 rounded-full bg-muted-foreground/20 border-2 border-card"
                    style={{ zIndex: 3 - i }}
                  />
                ),
              )}
            {profilesArray.length === 0 && (
              <div className="h-8 w-8 rounded-full bg-muted-foreground/20" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground">
              {headerName}
            </h3>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                statusDot[connectionStatus],
              )}
              title={connectionStatus}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="flex h-full flex-col gap-2 overflow-y-auto p-4 scrollbar-thin"
        >
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-8">
              Send a message to start a conversation with support.
            </p>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              agentProfile={
                msg.senderPubkey
                  ? agentProfiles.get(msg.senderPubkey)
                  : undefined
              }
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t px-3 py-2.5"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            connectionStatus === "connected"
              ? "Type a message..."
              : "Connecting..."
          }
          disabled={connectionStatus !== "connected"}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:opacity-50",
            "scrollbar-thin",
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={
            !input.trim() || isSending || connectionStatus !== "connected"
          }
          className="h-9 w-9 shrink-0 rounded-xl bg-orange-500 hover:bg-orange-600"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
