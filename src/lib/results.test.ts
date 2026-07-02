import { describe, expect, it } from "vitest";
import { diffResults, rewardBalanceLabel, totalVotes } from "./results";

describe("results helpers", () => {
  it("detects per-option result changes", () => {
    expect(diffResults([0, 1, 0, 0], [0, 2, 0, 1])).toEqual({
      changed: true,
      deltas: [0, 1, 0, 1],
    });
  });

  it("sums total votes", () => {
    expect(totalVotes([1, 2, 3, 4])).toBe(10);
  });

  it("formats reward-token balances", () => {
    expect(rewardBalanceLabel(1n)).toBe("1 reward token");
    expect(rewardBalanceLabel(2n)).toBe("2 reward tokens");
  });
});
