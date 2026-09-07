import { describe, expect, it } from "vitest";
import { totalFeeSats } from "./feeUtils";

describe("totalFeeSats", () => {
  it("adds the separately reported network fee", () => {
    expect(totalFeeSats({ fee_sats: 150, network_fee_sats: 100 })).toBe(250);
  });

  it("uses fee_sats alone when the response folds the network fee in", () => {
    expect(totalFeeSats({ fee_sats: 250 })).toBe(250);
  });
});
