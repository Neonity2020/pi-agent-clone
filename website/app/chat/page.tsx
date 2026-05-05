import { ChatContainer } from "@/components/chat/chat-container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat | Pi-Agent Clone",
};

export default function ChatPage() {
  return (
    <main className="container chat-page">
      <header className="chat-header">
        <a href="/" className="brand">Pi-Agent Clone</a>
        <span className="badge">Web Chat</span>
      </header>
      <ChatContainer />
    </main>
  );
}
