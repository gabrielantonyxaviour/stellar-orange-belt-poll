import {
  Account,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  EXPLORER_TX_URL,
  POLL_CONTRACT_ID,
  REWARD_TOKEN_CONTRACT_ID,
  SOROBAN_RPC_URL,
} from "./config";
import { normalizeContractError } from "./errors";
import type { SignTransaction } from "./wallet-kit";

const server = new rpc.Server(SOROBAN_RPC_URL);
const pollContract = new Contract(POLL_CONTRACT_ID);
const rewardTokenContract = new Contract(REWARD_TOKEN_CONTRACT_ID);
const READ_ONLY_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export async function getResults(pollId: number): Promise<number[]> {
  const retval = await simulateReadOnly(
    pollContract.call("get_results", nativeToScVal(BigInt(pollId), { type: "u64" })),
  );
  return resultXdrToNumbers(retval);
}

export async function getRewardBalance(address: string): Promise<bigint> {
  const retval = await simulateReadOnly(
    rewardTokenContract.call("balance", nativeToScVal(address, { type: "address" })),
  );
  return BigInt(scValToNative(retval));
}

export async function vote(
  pollId: number,
  voterAddress: string,
  optionIndex: number,
  signTransaction: SignTransaction,
): Promise<{ hash: string }> {
  const sourceAccount = await server.getAccount(voterAddress);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      pollContract.call(
        "vote",
        nativeToScVal(BigInt(pollId), { type: "u64" }),
        nativeToScVal(voterAddress, { type: "address" }),
        nativeToScVal(optionIndex, { type: "u32" }),
      ),
    )
    .setTimeout(300)
    .build();

  const preparedTransaction = await server.prepareTransaction(transaction);
  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    address: voterAddress,
  });
  const signedTransaction = TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET);
  const sendResponse = await server.sendTransaction(signedTransaction);

  if (sendResponse.status === "ERROR") {
    throw new Error(normalizeContractError(sendResponse.errorResult));
  }

  if (sendResponse.status === "TRY_AGAIN_LATER") {
    throw new Error("The Stellar testnet asked us to try again later. Wait a moment and retry.");
  }

  const hash = sendResponse.hash;
  const confirmation = await server.pollTransaction(hash, {
    attempts: 30,
    sleepStrategy: () => 1000,
  });

  if (confirmation.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(normalizeContractError(confirmation.resultXdr));
  }

  if (confirmation.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error("The vote transaction was submitted but was not confirmed before polling timed out.");
  }

  return { hash };
}

export function stellarExpertTxUrl(hash: string): string {
  return `${EXPLORER_TX_URL}/${hash}`;
}

export function resultXdrToNumbers(result: xdr.ScVal): number[] {
  const values = scValToNative(result) as Array<number | bigint>;
  return values.map((value) => Number(value));
}

async function simulateReadOnly(operation: xdr.Operation): Promise<xdr.ScVal> {
  const sourceAccount = new Account(READ_ONLY_SOURCE, "0");
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(normalizeContractError(simulation.error));
  }

  if (!simulation.result?.retval) {
    throw new Error("The contract did not return a value.");
  }

  return simulation.result.retval;
}
