import { describe, it, expect } from "vitest";
import { wouldLeaveZeroAdmins } from "./adminUtils.js";

describe("wouldLeaveZeroAdmins", () => {
  it("blocks demoting the only admin in a group", () => {
    const members = [{ name: "Harriet", role: "admin" }, { name: "Doreen", role: "member" }];
    expect(wouldLeaveZeroAdmins(members, "Harriet")).toBe(true);
  });

  it("allows demoting an admin when another admin remains", () => {
    const members = [
      { name: "Harriet", role: "admin" },
      { name: "Doreen", role: "admin" },
      { name: "Fridah", role: "member" },
    ];
    expect(wouldLeaveZeroAdmins(members, "Harriet")).toBe(false);
  });

  it("allows demoting someone who isn't an admin (no-op safety check)", () => {
    const members = [{ name: "Harriet", role: "admin" }, { name: "Doreen", role: "member" }];
    expect(wouldLeaveZeroAdmins(members, "Doreen")).toBe(false);
  });

  it("is case-insensitive when matching the target name", () => {
    const members = [{ name: "Harriet", role: "admin" }];
    expect(wouldLeaveZeroAdmins(members, "HARRIET")).toBe(true);
    expect(wouldLeaveZeroAdmins(members, "  harriet  ")).toBe(true);
  });

  it("returns false for a name that doesn't match any member", () => {
    const members = [{ name: "Harriet", role: "admin" }];
    expect(wouldLeaveZeroAdmins(members, "Nobody")).toBe(false);
  });

  it("handles an empty member list without throwing", () => {
    expect(wouldLeaveZeroAdmins([], "Anyone")).toBe(false);
  });
});
