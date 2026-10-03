import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Guard rails for the "never expose the secret key / server-only code to the browser" rules.
const SRC = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk(SRC)
  .filter((f) => !/\.test\.tsx?$/.test(f))
  .map((f) => ({ file: path.relative(SRC, f), text: readFileSync(f, "utf8") }));

const isClient = (text: string) => /^\s*["']use client["']/.test(text);

describe("secret handling", () => {
  it("only the admin client reads the Supabase secret key", () => {
    // Messages may mention the variable's name; only real reads of the environment count.
    const users = files.filter((f) => /process\.env\.SUPABASE_SECRET_KEY|process\.env\[["']SUPABASE_SECRET_KEY/.test(f.text)).map((f) => f.file);
    expect(users).toEqual([path.join("lib", "supabase", "admin.ts")]);
  });

  it("no NEXT_PUBLIC_ variable is named like a secret", () => {
    const bad = files.filter((f) => /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PASSWORD|PRIVATE)/.test(f.text)).map((f) => f.file);
    expect(bad).toEqual([]);
  });

  it("only the data door, the admin module and the health check create the admin client", () => {
    const users = files.filter((f) => f.text.includes("createAdminClient")).map((f) => f.file.split(path.sep).join("/")).sort();
    expect(users).toEqual(["app/api/health/route.ts", "lib/org.ts", "lib/supabase/admin.ts"]);
  });

  it("the data door checks for a signed-in account", () => {
    const org = files.find((f) => f.file === path.join("lib", "org.ts"))!;
    expect(org.text).toContain("getCurrentUser");
    expect(org.text).toContain("org_members");
  });
});

describe("server/client boundary", () => {
  const serverOnly = [
    "@/lib/supabase/admin",
    "@/lib/supabase/server",
    "@/lib/auth",
    "@/lib/org",
    "@/lib/activity",
    "@/lib/project-sync",
    "@/lib/queries",
    "@/lib/procurement-queries",
    "@/lib/permit-queries",
    "@/lib/document-queries",
    "@/lib/notification-queries",
  ];

  it("client components never import server-only modules", () => {
    for (const f of files.filter((x) => isClient(x.text))) {
      for (const mod of serverOnly) expect(f.text, `${f.file} imports ${mod}`).not.toContain(`"${mod}"`);
    }
  });

  it("server-only data modules declare themselves server-only", () => {
    for (const f of files.filter((x) => /(supabase[\\/]admin|lib[\\/](org|activity|project-sync|queries|[a-z-]+-queries))\.ts$/.test(x.file))) {
      expect(f.text, f.file).toContain('import "server-only"');
    }
  });

  it("every server action file starts with 'use server'", () => {
    for (const f of files.filter((x) => /app[\\/]actions[\\/]/.test(x.file))) {
      expect(f.text.trimStart().startsWith('"use server"'), f.file).toBe(true);
    }
  });
});
