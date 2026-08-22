import { describe, it, expect } from "vitest";
import { upsertGroupList } from "./myGroups.js";

const harriet = { groupSlug: "hillcrest", groupName: "Hillcrest Chilimba", name: "Harriet", role: "admin", token: "t1" };
const harrietOther = { groupSlug: "downtown", groupName: "Downtown Chilimba", name: "Harriet", role: "member", token: "t2" };

describe("upsertGroupList", () => {
  it("appends a new group to an empty list", () => {
    expect(upsertGroupList([], harriet)).toEqual([harriet]);
  });

  it("appends a second, different group alongside the first", () => {
    const result = upsertGroupList([harriet], harrietOther);
    expect(result).toEqual([harriet, harrietOther]);
  });

  it("updates in place (by groupSlug) rather than duplicating a re-joined group", () => {
    const refreshed = { ...harriet, token: "t1-refreshed", role: "member" };
    const result = upsertGroupList([harriet, harrietOther], refreshed);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(refreshed);
    expect(result[1]).toEqual(harrietOther);
  });

  it("only keeps the fields the switcher actually needs, dropping anything extra", () => {
    const withExtra = { ...harriet, isNew: true, extra: "ignored" };
    const result = upsertGroupList([], withExtra);
    expect(result[0]).toEqual(harriet);
  });

  it("does not mutate the input list", () => {
    const original = [harriet];
    upsertGroupList(original, harrietOther);
    expect(original).toEqual([harriet]);
  });
});
