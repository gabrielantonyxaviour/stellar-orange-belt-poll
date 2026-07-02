import { ResultsBar } from "./ResultsBar";
import { VoteButton } from "./VoteButton";

type PollCardProps = {
  question: string;
  options: readonly string[];
  results: number[];
  isResultsLoading: boolean;
  disabledReason: string | null;
  pendingOptionIndex: number | null;
  onVote: (optionIndex: number) => void;
};

export function PollCard({
  question,
  options,
  results,
  isResultsLoading,
  disabledReason,
  pendingOptionIndex,
  onVote,
}: PollCardProps) {
  return (
    <section className="poll-card">
      <h2>{question}</h2>
      {isResultsLoading ? <p>Loading poll results...</p> : null}
      <ul className="poll-options">
        {options.map((option, index) => (
          <li key={option}>
            <VoteButton
              option={option}
              optionIndex={index}
              disabledReason={disabledReason}
              isPending={pendingOptionIndex === index}
              onVote={onVote}
            />
            {disabledReason ? (
              <p id={`vote-disabled-${index}`} className="form-hint">
                {disabledReason}
              </p>
            ) : null}
            <ResultsBar option={option} count={results[index] ?? 0} results={results} />
          </li>
        ))}
      </ul>
    </section>
  );
}
