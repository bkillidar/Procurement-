/** Same-site redirect targets only (never an address someone else chose). */
export function safeNext(value: string | null | undefined): string {
  const v = value ?? "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && !v.startsWith("/login") ? v : "/";
}
