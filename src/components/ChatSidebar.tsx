import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
}

export function ChatSidebar({
  conversations,
  currentId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen,
  onClose,
  className
}: ChatSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className={cn("flex flex-col h-full bg-card border-r border-border w-64 transition-all duration-300", className)}>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <Button 
            onClick={onNewChat} 
            variant="secondary" 
            className="w-full justify-start gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-0"
        >
            <Plus className="w-4 h-4" />
            <span className="font-medium">New Chat</span>
        </Button>
        {onClose && (
             <Button variant="ghost" size="icon" className="md:hidden ml-2" onClick={onClose}>
                <X className="w-4 h-4" />
             </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-xs font-medium text-muted-foreground px-2 py-2 mb-1">Recent</div>
        {conversations.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 text-center py-4">No history yet</div>
        )}
        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "group flex items-center gap-2 px-2 py-2 text-sm rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
              currentId === chat.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
            )}
            onClick={() => onSelect(chat.id)}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate flex-1 text-left">
              {chat.title || "Untitled Chat"}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              title="Delete chat"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
