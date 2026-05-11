import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

// Viewport configuration for mobile and PWA
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'light dark',
}

export const metadata: Metadata = {
  title: 'HR Management System',
  description: 'Comprehensive HR Management Dashboard - Manage employees, attendance, payroll, and compliance with ease',
  
  // Basic metadata
  generator: 'Next.js',
  applicationName: 'HRMS',
  authors: [{ name: 'HR Management Team' }],
  keywords: ['HR', 'Management', 'HRMS', 'Human Resources', 'Employees', 'Attendance', 'Payroll'],
  
  // Manifest and PWA
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HRMS',
  },
  
  // Apple-specific configuration
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true,
    url: true,
  },
  
  // Open Graph (social sharing)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://yourapp.com',
    title: 'HR Management System',
    description: 'Comprehensive HR Management Dashboard',
    siteName: 'HRMS',
  },
  
  // Twitter metadata
  twitter: {
    card: 'summary_large_image',
    title: 'HR Management System',
    description: 'Comprehensive HR Management Dashboard',
  },
  
  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon and Apple icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/icons/icon-512.png" sizes="512x512" type="image/png" />
        
        {/* Apple touch icon - iOS home screen */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        
        {/* Apple status bar configuration */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HRMS" />
        
        {/* Microsoft specific */}
        <meta name="msapplication-TileColor" content="#1e40af" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Android/Chrome specific */}
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* PWA splash screen configuration */}
        <meta name="description" content="Comprehensive HR Management Dashboard" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
