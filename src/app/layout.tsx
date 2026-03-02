import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Closing",
  description: "Local daily operations closing tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
