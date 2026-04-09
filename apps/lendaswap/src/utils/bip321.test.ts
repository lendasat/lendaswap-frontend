import { describe, expect, it } from "vitest";
import { isSupportedUri, parseUri } from "./bip321";

describe("isSupportedUri", () => {
  it("accepts bitcoin: URIs", () => {
    expect(isSupportedUri("bitcoin:bc1qxyz")).toBe(true);
  });

  it("accepts lightning: URIs", () => {
    expect(isSupportedUri("lightning:lnbc12345")).toBe(true);
  });

  it("accepts ark: URIs", () => {
    expect(isSupportedUri("ark:ark1abc")).toBe(true);
  });

  it("is case-insensitive on scheme", () => {
    expect(isSupportedUri("BITCOIN:bc1qxyz")).toBe(true);
    expect(isSupportedUri("Lightning:lnbc1")).toBe(true);
  });

  it("rejects plain addresses", () => {
    expect(isSupportedUri("bc1qxyz")).toBe(false);
    expect(isSupportedUri("lnbc12345")).toBe(false);
  });

  it("rejects unsupported schemes", () => {
    expect(isSupportedUri("ethereum:0xabc")).toBe(false);
  });

  it("trims whitespace", () => {
    expect(isSupportedUri("  bitcoin:bc1qxyz  ")).toBe(true);
  });
});

describe("parseUri", () => {
  it("parses a simple bitcoin: URI", () => {
    const result = parseUri("bitcoin:bc1qxyz");
    expect(result).toEqual({ scheme: "bitcoin", address: "bc1qxyz" });
  });

  it("parses bitcoin: URI with amount", () => {
    const result = parseUri("bitcoin:bc1qxyz?amount=0.5");
    expect(result.address).toBe("bc1qxyz");
    expect(result.amount).toBe(0.5);
  });

  it("parses bitcoin: URI with label and message", () => {
    const result = parseUri(
      "bitcoin:bc1qxyz?amount=1&label=Donation&message=Thanks",
    );
    expect(result.amount).toBe(1);
    expect(result.label).toBe("Donation");
    expect(result.message).toBe("Thanks");
  });

  it("parses unified bitcoin: URI with lightning and ark params", () => {
    const uri =
      "bitcoin:bc1p7kv8jr09738j3yh5s0fyut0yzchkcj6vl7f2z4a0tufn65rpqdeq4wpq0x?ark=ark1qq4hfssprtcgnjzf8qlw2f78yvjau5kldfugg29k34y7j96q2w4t5akc3dy45v3ganpfxufszzcfay5udhkmwk3erpgmaxuphxshdapg7dy9g0&lightning=LNURL1DP68GURN8GHJ7MRWW4EXCTNPWF4KZER99EEKSTMVDE6HYMP0XDJRJVE5VYUNXDRRV5MKVVPKV3NRYVECVVMNSENZ8YUX2VEC8YCQAC2YFQ";
    const result = parseUri(uri);
    expect(result.scheme).toBe("bitcoin");
    expect(result.address).toBe(
      "bc1p7kv8jr09738j3yh5s0fyut0yzchkcj6vl7f2z4a0tufn65rpqdeq4wpq0x",
    );
    expect(result.ark).toBe(
      "ark1qq4hfssprtcgnjzf8qlw2f78yvjau5kldfugg29k34y7j96q2w4t5akc3dy45v3ganpfxufszzcfay5udhkmwk3erpgmaxuphxshdapg7dy9g0",
    );
    expect(result.lightning).toBe(
      "LNURL1DP68GURN8GHJ7MRWW4EXCTNPWF4KZER99EEKSTMVDE6HYMP0XDJRJVE5VYUNXDRRV5MKVVPKV3NRYVECVVMNSENZ8YUX2VEC8YCQAC2YFQ",
    );
  });

  it("parses a standalone lightning: URI", () => {
    const result = parseUri(
      "lightning:lnbc123450n1p5awwanpp5rqrr7gqqzrdnmnwgsnl7j82v9p02rxdzahj3zdqy5p403wugk9usdquf35kw6r5de5kueeqf9h8vmmfvdjscqz3txqyyzzssp55wxglttqtecewcmhurnvyl4jvjj0rn3cdrqdn3knkwh7f8x4w9fs9qxpqysgqu8fwg4vgdugzp6u32c7n8lpfe80a2vlul0nkxjqk2pqndrhwvghsnrlys0mwp54ljq4lm290dfq48dvadmm2vuwn38zruc6ev6dpfxqq0zzkya",
    );
    expect(result.scheme).toBe("lightning");
    expect(result.address).toMatch(/^lnbc/);
  });

  it("parses a standalone ark: URI", () => {
    const result = parseUri("ark:ark1235");
    expect(result).toEqual({ scheme: "ark", address: "ark1235" });
  });

  it("collects unknown params in otherParams", () => {
    const result = parseUri("bitcoin:bc1qxyz?amount=1&custom=foo&bar=baz");
    expect(result.otherParams).toEqual({ custom: "foo", bar: "baz" });
  });

  it("throws on missing address", () => {
    expect(() => parseUri("bitcoin:")).toThrow("Missing address");
  });

  it("throws on invalid amount", () => {
    expect(() => parseUri("bitcoin:bc1qxyz?amount=notanumber")).toThrow(
      "Invalid amount",
    );
  });

  it("throws on non-URI input", () => {
    expect(() => parseUri("bc1qxyz")).toThrow();
  });
});
