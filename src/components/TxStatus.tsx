import { stellarExpertTxUrl } from "../lib/contract";

export type TxStatusState =
  | { type: "idle" }
  | { type: "pending"; message: string }
  | { type: "success"; message: string; hash: string }
  | { type: "error"; message: string };

type TxStatusProps = {
  status: TxStatusState;
};

export function TxStatus({ status }: TxStatusProps) {
  if (status.type === "idle") {
    return null;
  }

  return (
    <section className={`tx-status tx-status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
      <p>{status.message}</p>
      {status.type === "success" ? (
        <p>
          Tx hash:{" "}
          <a href={stellarExpertTxUrl(status.hash)} target="_blank" rel="noreferrer">
            {status.hash}
          </a>
        </p>
      ) : null}
    </section>
  );
}
