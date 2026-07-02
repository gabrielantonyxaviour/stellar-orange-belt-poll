type WalletConnectProps = {
  address: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WalletConnect({
  address,
  isConnecting,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  return (
    <section className="wallet-connect">
      <h1>Token-Rewarded Poll</h1>
      {address ? (
        <>
          <p className="wallet-address">Connected: {address}</p>
          <button className="wallet-disconnect-button" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <button className="wallet-connect-button" type="button" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "Connect Freighter"}
        </button>
      )}
    </section>
  );
}
