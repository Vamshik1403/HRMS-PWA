import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import ServiceWorkerBootstrap from './components/ServiceWorkerBootstrap'
import FetchRefreshBootstrap from './components/FetchRefreshBootstrap'
import ProductAccessBootstrap from './components/ProductAccessBootstrap'
import { AdminShellProvider } from './components/layout/AdminShellProvider'
import { Providers } from './providers'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
})

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  adjustFontFallback: true,
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

// Viewport configuration for mobile and PWA
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'light',
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.openhrm.in',
  ),
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
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* Apply stored employee theme before paint to avoid light/dark flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('_emp_appearance');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-emp-theme','dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
        {/* Mark mobile / installed PWA early so desktop chrome never flashes */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var n=navigator,ua=n.userAgent||"",standalone=false;try{standalone=!!(n.standalone)||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.matchMedia('(display-mode: minimal-ui)').matches;}catch(e){}var mobile=/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)||(/Macintosh/i.test(ua)&&(n.maxTouchPoints||0)>1);var remembered=localStorage.getItem('_openhrm_mobile_pwa_layout')==='1';if(standalone){try{localStorage.setItem('_openhrm_mobile_pwa_layout','1');}catch(e){}}if(standalone||mobile||remembered){document.documentElement.setAttribute('data-emp-layout','mobile');document.documentElement.classList.add('emp-layout-mobile');}}catch(e){}})();`,
          }}
        />
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
      <body className={`${display.variable} ${sans.variable} ${mono.variable} min-h-screen bg-background font-sans subpixel-antialiased`}>
        <Providers>
          <ServiceWorkerBootstrap />
          <FetchRefreshBootstrap />
          <ProductAccessBootstrap />
          <AdminShellProvider>{children}</AdminShellProvider>
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}
