import type { Metadata } from "next";
import "./globals.css";
import "./extra.css";

export const metadata: Metadata = {
  icons: { icon: "/socsync-icon.svg", shortcut: "/socsync-icon.svg", apple: "/socsync-icon.svg" },
  title: "SocSync — Find your people at UCD",
  description: "SocSync helps you discover UCD societies, campus events, and your next favourite thing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
