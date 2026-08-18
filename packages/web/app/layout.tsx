import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Ponto RP — Dashboard",
  description: "Dashboard de bate-ponto para servidores GTA RP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
