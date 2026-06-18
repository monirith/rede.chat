import { describe, it, expect } from "vitest";
import { DEVICE_ID_RE } from "../src/auth";

describe("DEVICE_ID_RE — anonymous device-id format", () => {
  it("accepts a UUID v4 (36 chars with hyphens)", () => {
    expect(DEVICE_ID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a URL-safe base64 token", () => {
    expect(DEVICE_ID_RE.test("abcdef0123456789_-AbCdEfGhIjKl")).toBe(true);
  });

  it("rejects strings shorter than 16 characters", () => {
    expect(DEVICE_ID_RE.test("too-short")).toBe(false);
  });

  it("rejects strings longer than 128 characters", () => {
    expect(DEVICE_ID_RE.test("x".repeat(129))).toBe(false);
  });

  it("rejects characters outside [A-Za-z0-9_-]", () => {
    expect(DEVICE_ID_RE.test("not.a.valid/device/id!!!")).toBe(false);
    expect(DEVICE_ID_RE.test("has spaces in it AAAAAAA")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(DEVICE_ID_RE.test("")).toBe(false);
  });
});
