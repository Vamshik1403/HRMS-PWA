"use client";

import { taskAttachmentSrc } from "../../utils/taskAttachment";

export function TaskChatAttachmentImage({
  attachmentUrl,
  className = "",
}: {
  attachmentUrl?: string | null;
  className?: string;
}) {
  const src = taskAttachmentSrc(attachmentUrl);
  if (!src) return null;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={`block mt-1 ${className}`}>
      <img
        src={src}
        alt="Attachment"
        className="max-w-full rounded-lg max-h-48 object-cover border border-black/5"
        loading="lazy"
      />
    </a>
  );
}
