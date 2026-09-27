import { describe, it, expect } from "vitest";
import { resolveGroupName } from "./groupName.js";

describe("resolveGroupName", () => {
  it("prefers the live config name over the session snapshot", () => {
    const session = { groupName: "Hillcrest Chilimba" };
    const config = { groupName: "Hillcrest Chilimba" };
    expect(resolveGroupName(config, session)).toBe("Hillcrest Chilimba");
  });

  it("picks up a rename immediately — config updates, the session snapshot doesn't", () => {
    const session = { groupName: "Hillcrest Chilimba" };
    const renamedConfig = { groupName: "Riverside Chilimba" };
    expect(resolveGroupName(renamedConfig, session)).toBe("Riverside Chilimba");
  });

  it("falls back to the session snapshot before config has loaded", () => {
    expect(resolveGroupName({ groupName: "" }, { groupName: "Hillcrest Chilimba" })).toBe("Hillcrest Chilimba");
  });

  it("falls back to an empty string when neither is available", () => {
    expect(resolveGroupName(null, null)).toBe("");
  });
});
