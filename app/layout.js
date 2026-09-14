import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./admin/settings/settings.css";
import { LanguageProvider } from "./i18n/LanguageProvider";
import GlobalLanguageDrawer from "./i18n/GlobalLanguageDrawer";
import LocalizedLogout from "./i18n/LocalizedLogout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ADDIS RMS | Restaurant Operations",
  description: "Run restaurant operations smarter with ADDIS RMS.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <LanguageProvider>
          {children}
          <LocalizedLogout />
          <GlobalLanguageDrawer />
        </LanguageProvider>
      </body>
    </html>
  );
}
