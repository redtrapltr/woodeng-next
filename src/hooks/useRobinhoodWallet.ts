"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, formatEther, type Abi, type Hash } from "viem";
import { robinhoodChain, robinhoodPublicClient } from "../../app/lib/robinhoodChain";
import { useChainMode } from "../../app/contexts/NetworkContext";

// Wraps Privy's EVM embedded/external wallet (an EIP-1193 provider) in a viem
// WalletClient so write calls (createToken/buy/sell/approve) go through the
// same viem stack as the read side, instead of adding ethers as a dependency.
export function useRobinhoodWallet() {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const { isRobinhood } = useChainMode();
  const [ethBalance, setEthBalance] = useState<number | null>(null);

  // Any EVM wallet counts — embedded (social login) or external (MetaMask,
  // Phantom, connected via Privy's wallet modal). Don't restrict to embedded
  // only, and don't try to provision one ourselves here: Privy's own
  // embeddedWallets.ethereum.createOnLogin ('users-without-wallets', see
  // client-shell.tsx) handles that atomically at login time. Calling
  // createWallet() imperatively from an effect raced against Privy's own
  // wallets list settling right after an external wallet connects, and Privy
  // rejects it with "cannot have more than one ethereum embedded and one
  // imported wallet" since the just-connected wallet already counts.
  // w.chainType comes back undefined from Privy in practice (seen for
  // embedded, MetaMask, and Phantom-EVM wallets alike) — filter on the
  // address prefix instead, and prefer an explicitly-connected MetaMask over
  // the embedded wallet since that's the one the user picked.
  const evmWallet =
    wallets.find((w) => w.address?.startsWith("0x") && w.walletClientType === "metamask") ??
    wallets.find((w) => w.address?.startsWith("0x"));
  const address = (evmWallet?.address as `0x${string}` | undefined) ?? null;

  if (typeof window !== "undefined") {
    console.log("[RH WALLET DEBUG] ready:", ready, "authenticated:", authenticated);
    console.log("[RH WALLET DEBUG] wallets:", wallets.map((w) => ({
      address: w.address,
      chainType: w.chainType,
      walletClientType: (w as any).walletClientType,
      connectorType: (w as any).connectorType,
      chainId: (w as any).chainId,
    })));
    console.log("[RH WALLET DEBUG] evmWallet found:", !!evmWallet, evmWallet?.address);
  }

  // Toggling into Robinhood mode with an external EVM wallet (MetaMask, ...)
  // should prompt it to switch chains right away, rather than waiting for the
  // first write call to discover it's on the wrong network.
  useEffect(() => {
    if (!isRobinhood || !evmWallet) return;
    evmWallet.switchChain(robinhoodChain.id).catch((e) => {
      console.warn("[useRobinhoodWallet] chain switch failed:", e);
    });
  }, [isRobinhood, evmWallet]);

  const refreshBalance = useCallback(async () => {
    if (!address) { setEthBalance(null); return; }
    try {
      const bal = await robinhoodPublicClient.getBalance({ address });
      setEthBalance(Number(formatEther(bal)));
    } catch (e) {
      console.warn("[useRobinhoodWallet] balance fetch failed:", e);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    refreshBalance();
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [address, refreshBalance]);

  // Ensures the wallet's active chain is Robinhood Chain Testnet before we
  // sign, and builds a viem WalletClient over the raw EIP-1193 provider.
  const getWalletClient = useCallback(async () => {
    if (!evmWallet) throw new Error("No EVM wallet connected");

    // Privy's own switchChain handles both embedded and external wallets;
    // the provider must be re-requested afterward to pick up the new chain
    // (per Privy's docs — an already-fetched provider stays pinned to the old one).
    await evmWallet.switchChain(robinhoodChain.id);
    const provider = await evmWallet.getEthereumProvider();

    return createWalletClient({
      account: evmWallet.address as `0x${string}`,
      chain: robinhoodChain,
      transport: custom(provider),
    });
  }, [evmWallet]);

  const writeContract = useCallback(async (params: {
    address: `0x${string}`;
    abi: Abi | readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }): Promise<Hash> => {
    const client = await getWalletClient();
    // Robinhood Chain Testnet's base fee moves enough between estimation and
    // inclusion that viem's EIP-1559 estimate can land just under the base
    // fee at send time ("max fee per gas less than block base fee"). Legacy
    // gasPrice with a 50% buffer avoids that and is more reliable on L2s
    // generally — applies to every write (createToken/buy/sell) since they
    // all go through here.
    const gasPrice = await robinhoodPublicClient.getGasPrice();
    const bufferedGasPrice = (gasPrice * 150n) / 100n;
    const hash = await client.writeContract({
      address: params.address,
      abi: params.abi as Abi,
      functionName: params.functionName,
      args: params.args as any,
      value: params.value,
      chain: robinhoodChain,
      account: client.account!,
      gasPrice: bufferedGasPrice,
    });
    await robinhoodPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [getWalletClient]);

  return {
    connected: authenticated && !!address,
    address,
    ethBalance,
    refreshBalance,
    getWalletClient,
    writeContract,
  };
}
