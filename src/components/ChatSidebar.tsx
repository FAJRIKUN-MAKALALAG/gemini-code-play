import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className={cn("flex flex-col h-full bg-card border-r border-border w-full transition-all duration-300", className)}>
      {/* Header with New Chat button */}
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <Button
          onClick={onNewChat}
          variant="secondary"
          className="flex-1 justify-start gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-0 h-9 text-sm"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="font-medium">New Chat</span>
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2">
          Recent
        </div>
        {conversations.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 px-3">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
            No conversations yet
          </div>
        )}
        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "group flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150",
              currentId === chat.id
                ? "bg-primary/10 text-primary font-medium border border-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            onClick={() => onSelect(chat.id)}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate flex-1 text-left text-xs leading-snug">
              {chat.title || "Untitled Chat"}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive hover:bg-destructive/10 transition-all duration-150 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setChatToDelete(chat.id);
              }}
              title="Delete chat"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <AlertDialogContent className="w-[90vw] max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Hapus Percakapan?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Tindakan ini tidak dapat dibatalkan. Percakapan ini akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:mt-6">
            <AlertDialogCancel className="text-xs sm:text-sm h-9">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm h-9"
              onClick={() => {
                if (chatToDelete) {
                  onDelete(chatToDelete);
                  setChatToDelete(null);
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
