import { describe, expect, it } from "vitest";
import { normalizeContractError, normalizeWalletError } from "./errors";

describe("error normalizers", () => {
  it("normalizes contract double-vote errors", () => {
    expect(normalizeContractError("HostError: Error(Contract, #3)")).toContain("already voted");
  });

  it("normalizes missing wallet errors", () => {
    expect(normalizeWalletError(new Error("Freighter not installed")).message).toContain("Wallet not found");
  });

  it("normalizes rejected wallet connections", () => {
    expect(normalizeWalletError("User rejected request").message).toContain("Connection rejected");
  });
});
