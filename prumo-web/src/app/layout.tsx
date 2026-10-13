import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prumo",
  description: "Inteligência financeira para colocar sua casa no eixo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
