"use client";

import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";

const ICON = "size-3.5";

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
    <div className="flex items-center justify-end gap-0.5 flex-nowrap">
      {extra?.map(({ icon: Icon, title, onClick, className }) => (
        <Button key={title} variant="ghost" size="icon" className="size-8" title={title} onClick={onClick}>
          <Icon className={`${ICON} ${className || "text-primary"}`} />
        </Button>
      ))}
      {onView && (
        <Button variant="ghost" size="icon" className="size-8" title={viewTitle} onClick={onView}>
          <Eye className={`${ICON} text-muted-foreground`} />
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="icon" className="size-8" title={editTitle} onClick={onEdit}>
          <Pencil className={`${ICON} text-muted-foreground`} />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon" className="size-8" title={deleteTitle} onClick={handleDeleteClick}>
          <Trash2 className={`${ICON} text-destructive`} />
        </Button>
      )}
    </div>
  );
}
