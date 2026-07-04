"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

const cards = [
  {
    title: "Service Providers",
    value: "--",
    href: "/service-providers",
    icon: "mdi:account-supervisor-outline",
    color: "bg-blue-500",
  },
  {
    title: "Tenants",
    value: "--",
    href: "/company",
    icon: "mdi:domain",
    color: "bg-green-500",
  },
  {
    title: "System Users",
    value: "--",
    href: "/system-users",
    icon: "mdi:account-cog-outline",
    color: "bg-purple-500",
  },
  {
    title: "Subscriptions",
    value: "--",
    href: "/subscription",
    icon: "mdi:credit-card-outline",
    color: "bg-orange-500",
  },
];

export default function SuperDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage the complete HRMS SaaS platform.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border bg-card hover:shadow-lg transition-all p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>

                <h2 className="text-3xl font-bold mt-2">
                  {card.value}
                </h2>
              </div>

              <div
                className={`h-14 w-14 rounded-xl ${card.color} flex items-center justify-center`}
              >
                <Icon
                  icon={card.icon}
                  className="h-7 w-7 text-white"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          Platform Overview
        </h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">
              Total Service Providers
            </div>
            <div className="text-2xl font-bold mt-2">--</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">
              Total Tenants
            </div>
            <div className="text-2xl font-bold mt-2">--</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">
              Active Users
            </div>
            <div className="text-2xl font-bold mt-2">--</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">
              Active Subscriptions
            </div>
            <div className="text-2xl font-bold mt-2">--</div>
          </div>
        </div>
      </div>
    </div>
  );
}