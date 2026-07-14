import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptJson, encryptJson, GarminConfigError } from "./crypto.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("garmin token crypto", () => {
  beforeEach(() => {
    process.env.GARMIN_TOKEN_ENC_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.GARMIN_TOKEN_ENC_KEY;
  });

  it("round-trips a token object", () => {
    const tokens = { oauth1: { oauth_token: "a", oauth_token_secret: "b" }, oauth2: { access_token: "c" } };
    const blob = encryptJson(tokens);
    expect(blob).not.toContain("access_token");
    expect(decryptJson(blob)).toEqual(tokens);
  });

  it("produces a different blob each time (fresh IV)", () => {
    expect(encryptJson({ a: 1 })).not.toEqual(encryptJson({ a: 1 }));
  });

  it("rejects tampered ciphertext", () => {
    const blob = encryptJson({ secret: true });
    const parts = blob.split(".");
    const body = Buffer.from(parts[2]!, "base64");
    body[0] = body[0]! ^ 0xff;
    const tampered = `${parts[0]}.${parts[1]}.${body.toString("base64")}`;
    expect(() => decryptJson(tampered)).toThrow();
  });

  it("rejects malformed blobs", () => {
    expect(() => decryptJson("not-a-blob")).toThrow(GarminConfigError);
  });

  it("throws a config error when the key is missing", () => {
    delete process.env.GARMIN_TOKEN_ENC_KEY;
    expect(() => encryptJson({})).toThrow(GarminConfigError);
  });

  it("throws a config error when the key is the wrong size", () => {
    process.env.GARMIN_TOKEN_ENC_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptJson({})).toThrow(GarminConfigError);
  });
});
