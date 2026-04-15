"use client"

import { PageLayout } from "../components/layout/PageLayout"

export default function SystemSettingsPage() {
  return (
    <PageLayout>
      <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
        <p className="text-gray-600 text-sm">Manage main server settings</p>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">⚙️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">System Settings</h2>
          <p className="text-gray-500 text-sm">Main server settings configuration will be available here.</p>
        </div>
      </div>
    </PageLayout>
  )
}
