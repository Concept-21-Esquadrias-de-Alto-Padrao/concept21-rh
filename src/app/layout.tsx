import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { getDeploymentEnvironment } from "@/lib/environment";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: getDeploymentEnvironment().isHomologation ? "[TESTE] Concept21 Aluminium | RH" : "Concept21 Aluminium | RH",
  description: "Módulo interno de Recursos Humanos da Concept21 Aluminium",
  robots: getDeploymentEnvironment().isHomologation ? { index: false, follow: false } : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isTest = getDeploymentEnvironment().isHomologation;
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--environment-banner-height": isTest ? "48px" : "0px" } as CSSProperties}
    >
      <body className={`min-h-full flex flex-col ${isTest ? "pt-12" : ""}`}>
        <EnvironmentBanner />
        {children}
      </body>
    </html>
  );
}
