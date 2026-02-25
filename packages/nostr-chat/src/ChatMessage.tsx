import { cn } from "#/lib/utils";
import { Check, Clock, AlertCircle } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "./types";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChatMessageProps {
  message: ChatMessageType;
  supportAvatar?: string;
}

export function ChatMessage({ message, supportAvatar }: ChatMessageProps) {
  const isSent = message.direction === "sent";

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isSent ? "justify-end" : "justify-start",
      )}
    >
      {!isSent && (
        <div className="flex-shrink-0 mt-auto">
          {supportAvatar ? (
            <img
              src={supportAvatar}
              alt="Support"
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted-foreground/20" />
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isSent
            ? "bg-orange-500 text-white rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            isSent
              ? "justify-end text-white/70"
              : "justify-start text-muted-foreground",
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isSent && message.status === "sending" && (
            <Clock className="h-3 w-3" />
          )}
          {isSent && message.status === "sent" && <Check className="h-3 w-3" />}
          {isSent && message.status === "failed" && (
            <AlertCircle className="h-3 w-3 text-red-200" />
          )}
        </div>
      </div>
    </div>
  );
}
