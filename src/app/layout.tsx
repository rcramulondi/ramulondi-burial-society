import type { Metadata } from "next";
import NavBar from "@/components/layout/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ramulondi Burial Society",
  description: "Membership, contributions, and claims management",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-navy">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
