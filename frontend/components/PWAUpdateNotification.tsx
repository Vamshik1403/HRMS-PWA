'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * PWA Update Notification Component
 * Shows a notification when a new version is available
 * 
 * Usage:
 * import PWAUpdateNotification from '@/components/PWAUpdateNotification'
 * 
 * In your root layout or app component:
 * <PWAUpdateNotification />
 */
export default function PWAUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration) return

        // Check for updates on mount
        registration.update()

        // Listen for service worker state changes
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is waiting
              setUpdateAvailable(true)
              setDismissed(false)
            }
          })
        })
      })
    }
  }, [])

  const handleUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        // Tell the service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        
        // Reload when the new service worker takes over
        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true
            window.location.reload()
          }
        })
      }
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  if (!updateAvailable || dismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Update Available</h3>
          <p className="text-sm text-blue-100 mb-3">
            A new version of HRMS is available. Update now to get the latest features and improvements.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="text-blue-100 hover:text-white text-sm font-medium transition"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-100 hover:text-white transition flex-shrink-0 mt-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
