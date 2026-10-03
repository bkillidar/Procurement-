import { describe, expect, it } from "vitest";
import { findRemovableDuplicates, type DupProject } from "./duplicates";

const p = (id: string, created: string, over: Partial<DupProject> = {}): DupProject => ({
  id,
  name: "7814 Glenbrook rd",
  address: null,
  created_at: created,
  touched: false,
  ...over,
});

describe("findRemovableDuplicates", () => {
  it("keeps the oldest and removes the untouched copies", () => {
    expect(findRemovableDuplicates([p("b", "2"), p("a", "1"), p("c", "3")]).sort()).toEqual(["b", "c"]);
  });

  it("never removes a touched project, and keeps only touched ones when any exist", () => {
    expect(findRemovableDuplicates([p("a", "1"), p("b", "2", { touched: true }), p("c", "3")]).sort()).toEqual(["a", "c"]);
    expect(findRemovableDuplicates([p("a", "1", { touched: true }), p("b", "2", { touched: true })])).toEqual([]);
  });

  it("matches names ignoring case and extra spaces, and compares addresses too", () => {
    expect(findRemovableDuplicates([p("a", "1"), p("b", "2", { name: "  7814  GLENBROOK RD " })])).toEqual(["b"]);
    expect(findRemovableDuplicates([p("a", "1", { address: "1 Main St" }), p("b", "2", { address: "2 Oak St" })])).toEqual([]);
  });

  it("leaves unique projects alone", () => {
    expect(findRemovableDuplicates([p("a", "1"), p("b", "2", { name: "Faris House" })])).toEqual([]);
    expect(findRemovableDuplicates([])).toEqual([]);
  });
});
