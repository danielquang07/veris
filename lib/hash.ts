/** SHA-256 cua mot chuoi, tra ve hex. Chay duoc ca o trinh duyet lan server. */
export async function sha256(noiDung: string): Promise<string> {
  const duLieu = new TextEncoder().encode(noiDung);
  const buffer = await crypto.subtle.digest("SHA-256", duLieu);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
