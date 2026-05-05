import type { ChatSession } from "../../lib/use-chat-history";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ChatSidebar({ sessions, currentSessionId, onSelect, onDelete, onNew }: ChatSidebarProps) {
  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <button className="btn btn-primary" onClick={onNew} style={{ width: "100%", padding: "0.5rem" }}>
          + New Chat
        </button>
      </div>
      <div className="chat-sidebar-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`chat-sidebar-item ${session.id === currentSessionId ? "active" : ""}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="chat-sidebar-item-title">{session.title || "New Chat"}</div>
            <div className="chat-sidebar-item-date">
              {new Date(session.updatedAt).toLocaleDateString()}
            </div>
            <button
              className="chat-sidebar-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              title="Delete session"
            >
              ×
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="chat-sidebar-empty">No history yet</div>
        )}
      </div>
    </div>
  );
}
