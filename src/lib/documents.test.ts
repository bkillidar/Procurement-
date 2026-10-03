import { describe, expect, it } from "vitest";
import { buildStoragePath, isAllowedType, isImageType, pathBelongsTo, safeFileName } from "./documents";

describe("safeFileName", () => {
  it("replaces unsafe characters and keeps the extension", () => {
    expect(safeFileName("Plan Set (final) v2.pdf")).toBe("Plan_Set_final_v2.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc_passwd");
    expect(safeFileName("café résumé.png")).toBe("cafe_resume.png");
  });
  it("never returns an empty name", () => {
    expect(safeFileName("???")).toBe("file");
    expect(safeFileName("")).toBe("file");
  });
  it("caps long names but keeps the extension", () => {
    const n = safeFileName("a".repeat(200) + ".pdf");
    expect(n.length).toBeLessThanOrEqual(80);
    expect(n.endsWith(".pdf")).toBe(true);
  });
});

describe("storage paths", () => {
  const org = "11111111-1111-4111-8111-111111111111";
  const proj = "22222222-2222-4222-8222-222222222222";
  it("builds org/project/uuid-name paths", () => {
    expect(buildStoragePath(org, proj, "abc", "my plan.pdf")).toBe(`${org}/${proj}/abc-my_plan.pdf`);
  });
  it("only accepts paths inside the project folder", () => {
    expect(pathBelongsTo(`${org}/${proj}/x.pdf`, org, proj)).toBe(true);
    expect(pathBelongsTo(`${org}/other/x.pdf`, org, proj)).toBe(false);
    expect(pathBelongsTo(`other/${proj}/x.pdf`, org, proj)).toBe(false);
    expect(pathBelongsTo(`${org}/${proj}/../x.pdf`, org, proj)).toBe(false);
  });
});

describe("file types", () => {
  it("allows photos, PDFs and office files; blocks executables and scripts", () => {
    expect(isAllowedType("image/jpeg")).toBe(true);
    expect(isAllowedType("application/pdf")).toBe(true);
    expect(isAllowedType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isAllowedType("application/x-msdownload")).toBe(false);
    expect(isAllowedType("application/javascript")).toBe(false);
  });
  it("detects images", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("application/pdf")).toBe(false);
    expect(isImageType(null)).toBe(false);
  });
});
