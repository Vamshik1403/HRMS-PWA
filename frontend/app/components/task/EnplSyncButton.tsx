"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { taskFetch, type CurrentUserLike } from "../../utils/taskApi";

type EnplSyncResult = {
  imported?: { customers?: number; sites?: number; tasks?: number };
  errorCount?: number;
};

export function EnplSyncButton({
  user,
  onDone,
}: {
  user: CurrentUserLike | null | undefined;
  onDone?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  const run = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Syncing from ENPL…");
    try {
      const result = await taskFetch<EnplSyncResult>("/task-projects/sync-from-enpl", user, {
        method: "POST",
      });
      const imported = result.imported || {};
      const customers = imported.customers || 0;
      const sites = imported.sites || 0;
      const tasks = imported.tasks || 0;
      toast.success(`Imported ${customers} customers, ${sites} sites, ${tasks} tasks`, { id: toastId });
      if (result.errorCount) {
        toast.error(`${result.errorCount} items could not be imported`);
      }
      onDone?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "ENPL sync failed", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={run} disabled={syncing}>
      <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
      Sync
    </Button>
  );
}
