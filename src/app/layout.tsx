import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sift - Search with Clarity",
  description: "A fast, private search engine with AI-powered summaries, knowledge panels, and real-time answers",
  keywords: ["search", "search engine", "web search", "AI search", "private search"],
  authors: [{ name: "Sift" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sift",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Sift Search",
    description: "Fast, accurate web search with AI-powered summaries",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Sift" />
        <meta name="apple-mobile-web-app-title" content="Sift" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
