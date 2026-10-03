import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-path";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/projects/abc?view=open")).toBe("/projects/abc?view=open");
  });
  it("rejects open redirects and the login page itself", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});
