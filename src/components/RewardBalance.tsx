import { rewardBalanceLabel } from "../lib/results";

type RewardBalanceProps = {
  address: string | null;
  balance: bigint | null;
  isLoading: boolean;
};

export function RewardBalance({ address, balance, isLoading }: RewardBalanceProps) {
  return (
    <section className="reward-balance">
      <h2>Reward Balance</h2>
      {isLoading ? <p>Loading reward-token balance...</p> : <p>{rewardBalanceLabel(address ? balance : null)}</p>}
    </section>
  );
}
