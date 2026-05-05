import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "../components/chat/message-item";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  backendSessionId: string;
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("neonity-agent-chat-sessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to parse chat sessions", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Auto-create initial session if empty
  useEffect(() => {
    if (isLoaded && sessions.length === 0 && !currentSessionId) {
      const newSession: ChatSession = {
        id: `local_${Date.now()}`,
        title: "New Chat",
        updatedAt: Date.now(),
        messages: [],
        backendSessionId: "",
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    }
  }, [isLoaded, sessions.length, currentSessionId]);

  // Save to localStorage whenever sessions change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("neonity-agent-chat-sessions", JSON.stringify(sessions));
    }
  }, [sessions, isLoaded]);

  const createSession = useCallback(() => {
    const newSession: ChatSession = {
      id: `local_${Date.now()}`,
      title: "New Chat",
      updatedAt: Date.now(),
      messages: [],
      backendSessionId: "",
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        // Auto-generate title from first user message if title is default
        let newTitle = s.title;
        if (s.title === "New Chat" && updates.messages && updates.messages.length > 0) {
          const firstUserMsg = updates.messages.find(m => m.role === "user");
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30);
            if (firstUserMsg.content.length > 30) newTitle += "...";
          }
        }
        return { ...s, ...updates, title: newTitle, updatedAt: Date.now() };
      }).sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [currentSessionId]);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    updateSession,
    deleteSession,
    isLoaded,
  };
}
