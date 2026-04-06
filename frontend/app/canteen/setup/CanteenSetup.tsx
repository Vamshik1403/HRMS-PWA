"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Icon } from "@iconify/react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function CanteenSetup() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/canteen/setup`, { cache: "no-store" });
      const data = await res.json();
      setEnabled(!!data.default_token_enabled);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetup = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/canteen/setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_token_enabled: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSetup();
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Default Assigned Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            When enabled, all employees who check in automatically receive a
            canteen token. When disabled, employees must register via the Token
            Register device.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleSetup}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {enabled ? "Enabled" : "Disabled"}
            </span>
            {saving && (
              <Icon icon="mdi:loading" className="w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
