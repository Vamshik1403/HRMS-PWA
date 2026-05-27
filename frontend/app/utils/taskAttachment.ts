const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

export function taskAttachmentSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/backend")) return url;
  return `${BACKEND}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function uploadTaskAttachment(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
    throw new Error("Please select an image file (JPEG, PNG, GIF, or WebP)");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5MB");
  }
  const formData = new FormData();
  formData.append("file", file);
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
    : "";
  const res = await fetch(`${BACKEND}/files/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
  const { url } = await res.json();
  return typeof url === "string" ? url : "";
}
