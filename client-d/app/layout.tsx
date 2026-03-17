import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SSOProvider } from "pratham-sso";
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
  title: "Client D - SSO Integration",
  description: "Client application with Pratham SSO integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SSOProvider
          idpServer={process.env.NEXT_PUBLIC_IDP_SERVER!}
          clientId={process.env.NEXT_PUBLIC_CLIENT_ID!}
          redirectUri={process.env.NEXT_PUBLIC_REDIRECT_URI!}
          scope="openid profile email"
          enableWidget={true}
        >
          {children}
        </SSOProvider>
      </body>
    </html>
  );
}
