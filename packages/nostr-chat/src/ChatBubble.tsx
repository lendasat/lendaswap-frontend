import { MessageCircle } from "lucide-react";
import { cn } from "#/lib/utils";

interface ChatBubbleProps {
  onClick: () => void;
  unreadCount: number;
}

export function ChatBubble({ onClick, unreadCount }: ChatBubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex h-14 w-14 items-center justify-center",
        "rounded-full bg-orange-500 text-white shadow-lg",
        "transition-transform hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
      )}
      aria-label="Open support chat"
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1",
            "flex h-5 min-w-5 items-center justify-center",
            "rounded-full bg-red-500 px-1 text-[11px] font-bold text-white",
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
