import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neonity Agent | Autonomous Coding Agent',
  description:
    'A modern AI coding agent with multi-provider support for OpenAI, Anthropic, Gemini, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
