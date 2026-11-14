import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VivAI – Image to Video",
  description: "Turn any photo into a cinematic video using AI",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "VivAI" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: "cover", themeColor: "#08080f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg text-white font-sans antialiased min-h-screen overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
