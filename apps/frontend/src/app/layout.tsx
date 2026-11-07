import type { Metadata } from "next";
import { StoreFrame } from "../components/store-frame";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ok Family Store · Productos y lotes en Durango",
    template: "%s | Ok Family Store",
  },
  description:
    "Explora productos y lotes de disponibilidad limitada de Ok Family Store, en Jardines de Durango.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <StoreFrame>{children}</StoreFrame>
      </body>
    </html>
  );
}
