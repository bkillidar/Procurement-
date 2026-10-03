import { describe, expect, it } from "vitest";
import { accessToken, isPublicPath, safeEqual, safeNext } from "./access";

describe("accessToken", () => {
  it("is deterministic, hex, and never contains the password", async () => {
    const a = await accessToken("correct horse");
    expect(a).toBe(await accessToken("correct horse"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("correct");
  });
  it("differs for different passwords", async () => {
    expect(await accessToken("one")).not.toBe(await accessToken("two"));
  });
});

describe("safeEqual", () => {
  it("compares strings exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("isPublicPath", () => {
  it("only the unlock page and health check are open", () => {
    expect(isPublicPath("/unlock")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/unlockable")).toBe(false);
    expect(isPublicPath("/api/health/extra")).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/projects/abc?view=open")).toBe("/projects/abc?view=open");
  });
  it("rejects open redirects and the unlock page", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/unlock")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});
