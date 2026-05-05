import { ChatApp } from "@/components/chat/chat-app";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat | Pi-Agent Clone",
};

function Loading() {
  return <div className="chat-app-layout"><div style={{padding: '2rem'}}>Loading...</div></div>;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatApp />
    </Suspense>
  );
}