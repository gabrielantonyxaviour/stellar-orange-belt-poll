import { xdr } from "@stellar/stellar-sdk";

type XdrEnumLike = {
  name?: string;
  value?: number;
};

type DecodedTransactionError = {
  transactionCode?: string;
  transactionCodeValue?: number;
  operationCode?: string;
  operationCodeValue?: number;
  invokeCode?: string;
  invokeCodeValue?: number;
};

export function normalizeContractError(rawError?: string | xdr.TransactionResult): string {
  try {
    return normalizeContractErrorUnsafe(rawError);
  } catch {
    return "The contract rejected the transaction.";
  }
}

function normalizeContractErrorUnsafe(rawError?: string | xdr.TransactionResult): string {
  if (rawError instanceof xdr.TransactionResult) {
    return normalizeTransactionResultError(rawError);
  }

  const decodedResult = decodeTransactionResult(rawError);
  if (decodedResult) {
    return normalizeTransactionResultError(decodedResult);
  }

  const error = rawError ?? "";
  const lowerError = error.toLowerCase();

  if (lowerError.includes("alreadyvoted") || lowerError.includes("#3") || lowerError.includes("error(3)")) {
    return "This wallet has already voted in poll 1. The contract rejects duplicate votes.";
  }

  if (
    lowerError.includes("insufficient") ||
    lowerError.includes("underfunded") ||
    lowerError.includes("txinsufficientbalance") ||
    lowerError.includes("fee")
  ) {
    return "This wallet does not have enough testnet XLM to pay the transaction fee.";
  }

  if (lowerError.includes("hosterror") || lowerError.includes("contracterror")) {
    return "The poll contract rejected the transaction.";
  }

  if (looksLikeBase64Xdr(error)) {
    return "The contract rejected the transaction.";
  }

  return error || "The contract rejected the transaction.";
}

function normalizeTransactionResultError(result: xdr.TransactionResult): string {
  const decoded = decodeTransactionError(result);

  if (decoded.transactionCode === "txTooLate") {
    return "The vote transaction expired before it could be confirmed. Please approve the wallet request faster and try again.";
  }

  if (decoded.transactionCode === "txInsufficientBalance" || decoded.transactionCode === "txInsufficientFee") {
    return "This wallet does not have enough testnet XLM to pay the transaction fee.";
  }

  if (decoded.operationCode === "opBadAuth" || decoded.transactionCode === "txBadAuth") {
    return "The wallet signature was rejected. Reconnect your wallet and approve the vote again.";
  }

  if (decoded.invokeCode === "invokeHostFunctionTrapped") {
    return "The contract rejected the transaction. (code: invokeHostFunctionTrapped)";
  }

  const code = decoded.invokeCode ?? decoded.operationCode ?? decoded.transactionCode;
  const codeValue = decoded.invokeCodeValue ?? decoded.operationCodeValue ?? decoded.transactionCodeValue;

  if (code) {
    return `The contract rejected the transaction. (code: ${code}${codeValue === undefined ? "" : `/${codeValue}`})`;
  }

  return "The contract rejected the transaction.";
}

function decodeTransactionError(result: xdr.TransactionResult): DecodedTransactionError {
  const transactionCode = enumInfo(result.result().switch());
  const decoded: DecodedTransactionError = {
    transactionCode: transactionCode.name,
    transactionCodeValue: transactionCode.value,
  };

  if (transactionCode.name !== "txFailed") {
    return decoded;
  }

  const operationResult = result.result().results()?.[0];
  if (!operationResult) {
    return decoded;
  }

  const operationCode = enumInfo(operationResult.switch());
  decoded.operationCode = operationCode.name;
  decoded.operationCodeValue = operationCode.value;

  if (operationCode.name !== "opInner") {
    return decoded;
  }

  const operationInner = operationResult.tr();
  const operationInnerCode = enumInfo(operationInner.switch());
  decoded.operationCode = operationInnerCode.name;
  decoded.operationCodeValue = operationInnerCode.value;

  if (operationInnerCode.name !== "invokeHostFunction") {
    return decoded;
  }

  const invokeCode = enumInfo(operationInner.invokeHostFunctionResult().switch());
  decoded.invokeCode = invokeCode.name;
  decoded.invokeCodeValue = invokeCode.value;

  return decoded;
}

function decodeTransactionResult(rawError?: string): xdr.TransactionResult | undefined {
  if (!rawError || !looksLikeBase64Xdr(rawError)) {
    return undefined;
  }

  try {
    const result = xdr.TransactionResult.fromXDR(rawError, "base64");
    // Parsing can "succeed" on non-TransactionResult base64 input (e.g. a
    // plain simulation-error string that happens to match the base64
    // charset) and yield a malformed object whose nested accessors throw.
    // Verify the shape is actually usable before trusting it.
    result.result().switch();
    return result;
  } catch {
    return undefined;
  }
}

function enumInfo(value: XdrEnumLike): Required<XdrEnumLike> {
  return {
    name: value.name ?? "unknown",
    value: value.value ?? 0,
  };
}

function looksLikeBase64Xdr(value: string): boolean {
  return value.length >= 16 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return "";
}

export function normalizeWalletError(error: unknown): Error {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("not installed") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("could not find") ||
    lowerMessage.includes("no wallet")
  ) {
    return new Error("Wallet not found. Install or enable Freighter, then try connecting again.");
  }

  if (
    lowerMessage.includes("reject") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("cancel") ||
    lowerMessage.includes("closed")
  ) {
    return new Error("Connection rejected. Open the wallet modal and approve the request to continue.");
  }

  return new Error(message || "Wallet connection failed. Check your wallet and try again.");
}
