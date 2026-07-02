import { diffResults } from "./results";

type ResultsPollerOptions = {
  pollId: number;
  getResults: (pollId: number) => Promise<number[]>;
  onChange: (results: number[]) => void;
  onError: (error: Error) => void;
  intervalMs?: number;
};

export function startResultsPoller(options: ResultsPollerOptions): { stop: () => void } {
  let stopped = false;
  let lastResults: number[] | null = null;

  async function refresh() {
    try {
      const nextResults = await options.getResults(options.pollId);
      if (!lastResults || diffResults(lastResults, nextResults).changed) {
        options.onChange(nextResults);
        lastResults = nextResults;
      }
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error("Could not refresh poll results."));
    }
  }

  void refresh();
  const interval = window.setInterval(() => {
    if (!stopped) {
      void refresh();
    }
  }, options.intervalMs ?? 4000);

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(interval);
    },
  };
}
