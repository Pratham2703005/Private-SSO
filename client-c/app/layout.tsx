import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Client C - SSO App",
  description: "Client C - Single Sign-On Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="http://localhost:3000/api/widget.js"
          strategy="afterInteractive"
        />
        {/* Load RobotToast globally for toast notifications */}
        <Script
          src="http://localhost:3000/api/robot-toast.js"
          strategy="beforeInteractive"
          async
        />
        {/* Load RobotToast Utils for easy access to toast functions */}
        <Script
          src="http://localhost:3000/api/robot-toast-utils.js"
          strategy="beforeInteractive"
          async
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
