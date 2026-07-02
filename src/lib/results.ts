export type ResultsDiff = {
  changed: boolean;
  deltas: number[];
};

export function diffResults(previous: number[], next: number[]): ResultsDiff {
  const maxLength = Math.max(previous.length, next.length);
  const deltas = Array.from({ length: maxLength }, (_, index) => {
    return (next[index] ?? 0) - (previous[index] ?? 0);
  });

  return {
    changed: deltas.some((delta) => delta !== 0),
    deltas,
  };
}

export function totalVotes(results: number[]): number {
  return results.reduce((sum, value) => sum + value, 0);
}

export function rewardBalanceLabel(balance: number | bigint | null): string {
  if (balance === null) {
    return "Connect a wallet to view your reward balance.";
  }

  return `${balance.toString()} reward token${balance === 1 || balance === 1n ? "" : "s"}`;
}
