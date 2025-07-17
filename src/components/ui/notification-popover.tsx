import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface Message {
  id: string;
  sender: { first_name: string; last_name: string };
  content: string;
  created_at: string;
  read?: boolean;
}

interface NotificationPopoverProps {
  messages: Message[];
  onReply: (msg: Message, reply: string) => void;
  onViewAll: () => void;
  unreadCount: number;
}

export function NotificationPopover({ messages, onReply, onViewAll, unreadCount }: NotificationPopoverProps) {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-4 border-b font-semibold">Inbox</div>
        <div className="max-h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No messages</div>
          ) : (
            <ul className="divide-y">
              {messages.slice(0, 8).map(msg => (
                <li key={msg.id} className="p-3 hover:bg-gray-50 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{msg.sender.first_name} {msg.sender.last_name}</span>
                    <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-700 truncate mb-1">{msg.content}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setReplyingTo(msg)}>Reply</Button>
                  </div>
                  {replyingTo?.id === msg.id && (
                    <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); onReply(msg, replyContent); setReplyContent(""); setReplyingTo(null); }}>
                      <input
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        placeholder="Type reply..."
                        value={replyContent}
                        onChange={e => setReplyContent(e.target.value)}
                        autoFocus
                        required
                      />
                      <Button size="sm" type="submit">Send</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-2 border-t text-center">
          <Button variant="link" size="sm" onClick={() => { setOpen(false); onViewAll(); }}>View All</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
} 