"use client";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">You do not have permission to access this page.</h1>
        <p className="text-sm text-muted-foreground">
          This page is available to a superadmin session only.
        </p>
        <a href="/login" className="inline-block text-sm text-blue-600">
          Back to sign in
        </a>
      </div>
    </main>
  );
}
