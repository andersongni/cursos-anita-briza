import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from 'react-hot-toast'
import FontScaleProvider from '@/components/accessibility/FontScaleProvider'

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Plataforma de Estudos | Núcleo Assistencial Anita Briza",
  description: "Plataforma de estudos do Núcleo Assistencial Anita Briza",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <FontScaleProvider />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
