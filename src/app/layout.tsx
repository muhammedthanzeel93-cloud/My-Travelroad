import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "My Travelroad — Discover Malappuram, Kerala",
    template: "%s | My Travelroad",
  },
  description:
    "Tourism discovery and trip-planning platform starting with Malappuram, Kerala.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background font-sans antialiased text-text-primary">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
