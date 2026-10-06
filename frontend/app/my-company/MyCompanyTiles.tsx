"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/app/components/app/page-header";
import { cn } from "@/app/utils/cn";
import { isHubTabAllowed, useProductAccess } from "@/lib/productAccess";
import { COMPANY_HUB_TILES, filterCompanyHubTiles } from "./hubs";

export function MyCompanyTiles() {
  useProductAccess();
  const tiles = filterCompanyHubTiles(COMPANY_HUB_TILES, isHubTabAllowed);
  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader
        icon={Building2}
        title="My Company"
        description="Open a module from the tile menu, then use its tabs."
      />
      <div className="grid w-full grid-cols-9 justify-items-center gap-x-4 gap-y-8 px-1 py-2">
        {tiles.map((tile, index) => (
          <Link
            key={tile.id}
            href={`/my-company/${tile.id}`}
            className="group relative flex w-full max-w-[104px] flex-col items-center gap-2 outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5"
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            <div
              className={cn(
                "relative flex aspect-square w-full items-center justify-center rounded-2xl",
                "bg-[#F3F4F6] transition-colors duration-200 group-hover:bg-[#E8ECF1]",
              )}
            >
              <Icon icon={tile.icon} className={cn("size-11", tile.iconClassName)} />
            </div>
            <p className="w-full text-center text-[12px] font-medium leading-snug text-foreground">
              {tile.label}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
