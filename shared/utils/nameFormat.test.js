import { describe, it, expect } from "vitest";
import { formatAccountName } from "./nameFormat.js";

describe("formatAccountName", () => {
  it("title-cases lowercase names", () => {
    expect(formatAccountName("john patrick lalo")).toBe("John Patrick Lalo");
  });

  it("normalizes all-caps names", () => {
    expect(formatAccountName("JUAN DELA CRUZ")).toBe("Juan Dela Cruz");
  });

  it("splits camelCase input into words", () => {
    expect(formatAccountName("johnPatrickLalo")).toBe("John Patrick Lalo");
  });

  it("trims and collapses extra whitespace", () => {
    expect(formatAccountName("  john   patrick  lalo ")).toBe("John Patrick Lalo");
  });

  it("keeps already formatted names unchanged", () => {
    expect(formatAccountName("John Patrick Lalo")).toBe("John Patrick Lalo");
    expect(formatAccountName("Ronald McDonald")).toBe("Ronald McDonald");
  });

  it("capitalizes hyphenated and apostrophe names", () => {
    expect(formatAccountName("anne-marie")).toBe("Anne-Marie");
    expect(formatAccountName("o'neil")).toBe("O'Neil");
  });

  it("does not change email-like usernames", () => {
    expect(formatAccountName("john.doe@example.com")).toBe("john.doe@example.com");
  });

  it("passes through empty values", () => {
    expect(formatAccountName("")).toBe("");
    expect(formatAccountName("   ")).toBe("");
    expect(formatAccountName(null)).toBe(null);
    expect(formatAccountName(undefined)).toBe(undefined);
  });
});
