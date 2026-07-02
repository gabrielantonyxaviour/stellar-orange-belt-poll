import { useCallback, useEffect, useMemo, useState } from "react";
import { PollCard } from "./components/PollCard";
import { RewardBalance } from "./components/RewardBalance";
import { TxStatus, type TxStatusState } from "./components/TxStatus";
import { WalletConnect } from "./components/WalletConnect";
import {
  POLL_ID,
  POLL_OPTIONS,
  POLL_QUESTION,
} from "./lib/config";
import { getRewardBalance, getResults, vote } from "./lib/contract";
import { normalizeContractError } from "./lib/errors";
import { startResultsPoller } from "./lib/events";
import {
  disconnectWallet,
  openWalletModal,
  type SignTransaction,
} from "./lib/wallet-kit";

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [signTransaction, setSignTransaction] = useState<SignTransaction | null>(null);
  const [results, setResults] = useState<number[]>(() => POLL_OPTIONS.map(() => 0));
  const [rewardBalance, setRewardBalance] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResultsLoading, setIsResultsLoading] = useState(true);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [pendingOptionIndex, setPendingOptionIndex] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatusState>({ type: "idle" });
  const [votedAddresses, setVotedAddresses] = useState<Set<string>>(() => new Set());

  const refreshBalance = useCallback(async (walletAddress: string) => {
    setIsBalanceLoading(true);
    try {
      setRewardBalance(await getRewardBalance(walletAddress));
    } catch (error) {
      setTxStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not load reward-token balance.",
      });
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    const poller = startResultsPoller({
      pollId: POLL_ID,
      getResults,
      onChange: (nextResults) => {
        setResults(nextResults);
        setIsResultsLoading(false);
      },
      onError: (error) => {
        setIsResultsLoading(false);
        setTxStatus({ type: "error", message: error.message });
      },
    });

    return poller.stop;
  }, []);

  useEffect(() => {
    if (address) {
      void refreshBalance(address);
    } else {
      setRewardBalance(null);
    }
  }, [address, refreshBalance]);

  const hasVoted = useMemo(() => Boolean(address && votedAddresses.has(address)), [address, votedAddresses]);
  const disabledReason = !address
    ? "Connect a wallet to vote."
    : hasVoted
      ? "This connected wallet has already voted in this browser."
      : null;

  async function handleConnect() {
    setIsConnecting(true);
    setTxStatus({ type: "idle" });

    try {
      const wallet = await openWalletModal();
      setAddress(wallet.address);
      setSignTransaction(() => wallet.signTransaction);
    } catch (error) {
      setTxStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Wallet connection failed.",
      });
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectWallet();
    setAddress(null);
    setSignTransaction(null);
    setTxStatus({ type: "idle" });
  }

  async function handleVote(optionIndex: number) {
    if (!address || !signTransaction) {
      setTxStatus({ type: "error", message: "Connect a wallet before voting." });
      return;
    }

    setPendingOptionIndex(optionIndex);
    setTxStatus({ type: "pending", message: "Waiting for wallet signature and Stellar confirmation..." });

    try {
      const { hash } = await vote(POLL_ID, address, optionIndex, signTransaction);
      setVotedAddresses((current) => new Set(current).add(address));
      setTxStatus({ type: "success", message: "Vote confirmed and reward token minted.", hash });
      setResults(await getResults(POLL_ID));
      await refreshBalance(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : normalizeContractError();
      const normalizedMessage = normalizeContractError(message);
      if (normalizedMessage.includes("already voted")) {
        setVotedAddresses((current) => new Set(current).add(address));
      }
      setTxStatus({ type: "error", message: normalizedMessage });
    } finally {
      setPendingOptionIndex(null);
    }
  }

  return (
    <main className="app-shell">
      <WalletConnect
        address={address}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <PollCard
        question={POLL_QUESTION}
        options={POLL_OPTIONS}
        results={results}
        isResultsLoading={isResultsLoading}
        disabledReason={disabledReason}
        pendingOptionIndex={pendingOptionIndex}
        onVote={handleVote}
      />
      <RewardBalance address={address} balance={rewardBalance} isLoading={isBalanceLoading} />
      <TxStatus status={txStatus} />
    </main>
  );
}
