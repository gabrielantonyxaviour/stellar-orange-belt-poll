type VoteButtonProps = {
  option: string;
  optionIndex: number;
  disabledReason: string | null;
  isPending: boolean;
  onVote: (optionIndex: number) => void;
};

export function VoteButton({
  option,
  optionIndex,
  disabledReason,
  isPending,
  onVote,
}: VoteButtonProps) {
  return (
    <button
      className="vote-button"
      type="button"
      disabled={Boolean(disabledReason) || isPending}
      aria-describedby={disabledReason ? `vote-disabled-${optionIndex}` : undefined}
      onClick={() => onVote(optionIndex)}
    >
      {isPending ? "Voting..." : `Vote for ${option}`}
    </button>
  );
}
