import type { Metadata } from "next";
import { StoreHeader } from "@/components/store-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afsheen Collection",
  description: "Discover something special at Afsheen Collection.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <StoreHeader />
        {children}
      </body>
    </html>
  );
}
