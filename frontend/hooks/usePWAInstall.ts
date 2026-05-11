'use client'

import { useEffect, useState } from 'react'

interface ServiceWorkerMessage {
  type: 'SKIP_WAITING' | 'UPDATE_AVAILABLE'
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Check if PWA is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA is installed')
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed')
      setIsInstallable(false)
      setDeferredPrompt(null)
    })

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      // Check for updates periodically
      const checkForUpdates = () => {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.update()
          }
        })
      }

      // Check immediately and then every minute
      checkForUpdates()
      const interval = setInterval(checkForUpdates, 60000)

      // Listen for service worker controller change (indicates update)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent<ServiceWorkerMessage>) => {
        const message = event.data as ServiceWorkerMessage
        if (message.type === 'UPDATE_AVAILABLE') {
          setUpdateAvailable(true)
          console.log('PWA update available')
        }
      })

      return () => {
        clearInterval(interval)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    }
  }, [])

  const installApp = async () => {
    if (!deferredPrompt) {
      console.log('Installation not available')
      return
    }

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }

    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  const skipWaiting = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    }
  }

  return {
    isInstallable,
    installApp,
    updateAvailable,
    skipWaiting,
    deferredPrompt,
  }
}

export default usePWAInstall
