import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriIsoko | Rwanda Food Intelligence",
  description: "A traceable agricultural marketplace and food intelligence workspace for Rwanda.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
