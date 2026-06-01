const UPLOAD_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"}/files/upload`;

export async function uploadPdfFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error("PDF upload failed");
  const data = await res.json();
  const raw = data.url as string;
  if (raw.startsWith("/uploads/")) return `/backend${raw}`;
  return raw;
}
