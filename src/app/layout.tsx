import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sift - Search with Clarity",
  description: "A beautiful, private search engine with AI-powered summaries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
