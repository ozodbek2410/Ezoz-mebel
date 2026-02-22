export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const token = localStorage.getItem("token");
  const res = await fetch("/api/upload/product-image", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload xatosi" }));
    throw new Error(err.error || "Upload xatosi");
  }

  const data = await res.json();
  return data.filePath;
}
