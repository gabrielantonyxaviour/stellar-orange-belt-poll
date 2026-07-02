import { totalVotes } from "../lib/results";

type ResultsBarProps = {
  option: string;
  count: number;
  results: number[];
};

export function ResultsBar({ option, count, results }: ResultsBarProps) {
  const total = totalVotes(results);
  const percentage = total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <div className="results-row">
      <span>{option}</span>
      <progress value={percentage} max={100}>
        {percentage}%
      </progress>
      <span>
        {count} vote{count === 1 ? "" : "s"} ({percentage}%)
      </span>
    </div>
  );
}
