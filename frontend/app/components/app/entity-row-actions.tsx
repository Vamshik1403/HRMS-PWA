"use client";

import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";

const ICON = "size-3.5";
const ACTION_BTN =
  "size-[34px] rounded-lg border-0 bg-transparent text-muted-foreground shadow-none hover:bg-[#F3F4F6] hover:text-foreground dark:hover:bg-muted";

interface EntityRowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
  /** Set false when the parent handler already asks for confirmation. */
  confirmDelete?: boolean;
  deleteConfirmMessage?: string;
  extra?: { icon: LucideIcon; title: string; onClick: () => void; className?: string }[];
}

export function EntityRowActions({
  onView,
  onEdit,
  onDelete,
  viewTitle = "View",
  editTitle = "Edit",
  deleteTitle = "Delete",
  confirmDelete: shouldConfirmDelete = true,
  deleteConfirmMessage = "Are you sure you want to delete this record?",
  extra,
}: EntityRowActionsProps) {
  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (shouldConfirmDelete && !window.confirm(deleteConfirmMessage)) return;
    onDelete();
  };

  return (
    <div
      className="flex flex-nowrap items-center justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {extra?.map(({ icon: Icon, title, onClick, className }) => (
        <Button
          key={title}
          variant="ghost"
          size="icon"
          className={ACTION_BTN}
          title={title}
          onClick={onClick}
        >
          <Icon className={cn(ICON, className || "text-primary")} />
        </Button>
      ))}
      {onView ? (
        <Button
          variant="ghost"
          size="icon"
          className={ACTION_BTN}
          title={viewTitle}
          onClick={onView}
        >
          <Eye className={ICON} />
        </Button>
      ) : null}
      {onEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className={ACTION_BTN}
          title={editTitle}
          onClick={onEdit}
        >
          <Pencil className={ICON} />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn(ACTION_BTN, "hover:text-destructive")}
          title={deleteTitle}
          onClick={handleDeleteClick}
        >
          <Trash2 className={cn(ICON, "text-destructive")} />
        </Button>
      ) : null}
    </div>
  );
}
