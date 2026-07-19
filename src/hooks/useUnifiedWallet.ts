import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export function useUnifiedWallet() {
  const { authenticated, user, logout, exportWallet } = usePrivy();
  const { wallets: privyWallets } = useSolanaWallets();
  const solanaWallet = useSolanaWallet();
  const { connection } = useConnection();

  // Privy embedded Solana wallet — filter to Solana addresses only, then try multiple selectors
  const solanaCandidates = privyWallets.filter(w =>
    w.address && !w.address.startsWith("0x") && w.address.length >= 32 && w.address.length <= 44
  );
  const privyWallet = solanaCandidates.find(w => w.walletClientType === "privy")
    ?? solanaCandidates.find(w => (w as any).connectorType === "embedded")
    ?? solanaCandidates[0];

  // Embedded (Privy-created) wallet vs an external wallet the user connected
  // through Privy's modal (Phantom, Solflare, Glow, Backpack, ...).
  const isEmbeddedWallet = privyWallet?.walletClientType === "privy";
  const walletClientType: string | null = privyWallet?.walletClientType ?? null;

  // Address chain: embedded wallet → user.wallet fallback → external adapter
  const effectiveAddress: string | null =
    privyWallet?.address
    ?? (user as any)?.wallet?.address
    ?? solanaWallet?.publicKey?.toBase58()
    ?? null;

  let publicKey: PublicKey | null = null;
  if (effectiveAddress) {
    try {
      publicKey = new PublicKey(effectiveAddress);
    } catch {
      // Not a valid Solana address (e.g. EVM 0x address) — ignore
      publicKey = null;
    }
  }

  const connected = !!(effectiveAddress);

  // Poll getSignatureStatuses over HTTP instead of relying on a WS
  // signature subscription — RPC websocket endpoints (esp. behind proxies)
  // can silently fail ("ws error: undefined"), leaving a WS-based confirm
  // hanging indefinitely even though the tx already landed.
  const confirmByPolling = async (signature: string, timeoutMs = 60000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { value } = await connection.getSignatureStatuses([signature]);
      const status = value[0];
      if (status) {
        if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error("Confirmation timed out — check the signature on Solscan before retrying");
  };

  const sendTransaction = async (transaction: Transaction): Promise<string> => {
    if (privyWallet) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(privyWallet.address);
      // Sign + send + confirm manually rather than privyWallet.sendTransaction(),
      // which confirms internally via WS and can hang — see confirmByPolling above.
      const signed = await privyWallet.signTransaction(transaction);
      const raw = signed.serialize();
      const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
      await confirmByPolling(sig);
      return sig;
    } else if (solanaWallet?.sendTransaction) {
      return await solanaWallet.sendTransaction(transaction, connection);
    }
    throw new Error("No wallet connected");
  };

  const signTransaction = async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
    if (privyWallet) {
      if ("recentBlockhash" in transaction && !transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        (transaction as Transaction).recentBlockhash = blockhash;
        (transaction as Transaction).feePayer = new PublicKey(privyWallet.address);
      }
      return await privyWallet.signTransaction(transaction);
    } else if (solanaWallet?.signTransaction) {
      return await solanaWallet.signTransaction(transaction);
    }
    throw new Error("No wallet connected");
  };

  const xAccount = user?.linkedAccounts?.find((a: any) => a.type === "twitter_oauth");
  const displayName = xAccount?.username
    ? `@${(xAccount as any).username}`
    : (user?.email as any)?.address
    ?? publicKey?.toBase58().slice(0, 6)
    ?? "Not connected";

  return {
    publicKey,
    connected,
    authenticated,
    sendTransaction,
    signTransaction,
    logout,
    exportWallet,
    displayName,
    user,
    walletType: privyWallet ? ("privy" as const) : ("external" as const),
    isEmbeddedWallet,
    walletClientType,
    address: publicKey?.toBase58() ?? null,
  };
}
