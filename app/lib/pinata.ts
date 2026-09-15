// Shared IPFS pinning helpers — used by both the create-token flow and the
// Living Meme metadata-update flow, so a token's metadata JSON always takes
// the same shape regardless of which flow produced it.
export async function pinFile(file: File): Promise<string> {
  const { jwt } = await fetch("/api/pinata-token").then((r) => {
    if (!r.ok) throw new Error("Could not fetch Pinata token");
    return r.json() as Promise<{ jwt: string }>;
  });
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Pinata upload failed");
  return `ipfs://${data.IpfsHash}`;
}

export async function pinJson(data: unknown, filename = "metadata.json"): Promise<string> {
  return pinFile(new File([JSON.stringify(data)], filename, { type: "application/json" }));
}
