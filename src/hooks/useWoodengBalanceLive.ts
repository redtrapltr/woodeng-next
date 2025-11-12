import { useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

function toUi(amountStr?: string, decimals?: number) {
  const amount = Number(amountStr ?? '0');
  const d = typeof decimals === 'number' ? decimals : 0;
  return amount / Math.pow(10, d);
}

/**
 * Live WOODENG balance. Works on Token + Token-2022, ATA or any token account.
 */
export function useWoodengBalanceLive(
  connection: Connection,
  owner?: PublicKey | null,
  mint?: PublicKey | null
) {
  const [bal, setBal] = useState(0);

  // re-run only when owner/mint changes
  const depsKey = useMemo(
    () => `${owner?.toBase58() ?? ''}:${mint?.toBase58() ?? ''}`,
    [owner, mint]
  );

  useEffect(() => {
    if (!connection || !owner || !mint) {
      setBal(0);
      return;
    }

    let disposed = false;
    let ataSubId: number | null = null;
    let pollId: number | null = null;

    const readATA = async (programId: PublicKey) => {
      const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
      try {
        const r = await connection.getTokenAccountBalance(ata, 'processed');
        const ui =
          r?.value?.uiAmount ??
          toUi(r?.value?.amount, r?.value?.decimals);
        return { ata, amount: ui, exists: true };
      } catch {
        return { ata, amount: 0, exists: false };
      }
    };

    // Fallback: scan & sum ALL token accounts for this mint (unparsed -> robust)
    const scanAllAccounts = async () => {
      try {
        const resp = await connection.getTokenAccountsByOwner(owner, { mint }, 'confirmed');
        if (!resp || resp.value.length === 0) return 0;

        let sum = 0;
        await Promise.all(
          resp.value.map(async ({ pubkey }) => {
            try {
              const b = await connection.getTokenAccountBalance(pubkey, 'processed');
              const ui =
                b?.value?.uiAmount ??
                toUi(b?.value?.amount, b?.value?.decimals);
              sum += Number(ui || 0);
            } catch {}
          })
        );
        return sum;
      } catch {
        return 0;
      }
    };

    const refresh = async () => {
      try {
        // Detect token program of the mint
        const mintInfo = await connection.getAccountInfo(mint, 'confirmed');
        const programId =
          mintInfo?.owner?.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

        // Try ATA (fast + subscribable)
        const { ata, amount, exists } = await readATA(programId);

        // Debug breadcrumbs (can remove later)
        console.debug('[WOODENG] RPC:', (connection as any)?.rpcEndpoint);
        console.debug('[WOODENG] owner:', owner.toBase58());
        console.debug('[WOODENG] mint:', mint.toBase58());
        console.debug('[WOODENG] tokenProgram:', programId.toBase58());
        console.debug('[WOODENG] ATA:', ata.toBase58(), 'exists=', exists, 'amount=', amount);

        if (!disposed) setBal(Number(amount || 0));

        if (exists) {
          // live subscribe ATA updates
          if (ataSubId !== null) {
            try { await connection.removeAccountChangeListener(ataSubId); } catch {}
            ataSubId = null;
          }
          ataSubId = connection.onAccountChange(
            ata,
            async () => {
              try {
                const rr = await connection.getTokenAccountBalance(ata, 'processed');
                const ui =
                  rr?.value?.uiAmount ??
                  toUi(rr?.value?.amount, rr?.value?.decimals);
                if (!disposed) setBal(Number(ui || 0));
              } catch {
                if (!disposed) setBal(0);
              }
            },
            'processed'
          );
        } else {
          // No ATA? Sum all token accounts for this mint
          const total = await scanAllAccounts();
          console.debug('[WOODENG] sum(all token accounts)=', total);
          if (!disposed) setBal(Number(total || 0));

          // Poll occasionally when not on an ATA
          if (pollId) clearInterval(pollId);
          pollId = window.setInterval(async () => {
            const t = await scanAllAccounts();
            if (!disposed) setBal(Number(t || 0));
          }, 10_000);
        }
      } catch (e) {
        console.warn('[WOODENG] refresh error:', e);
        if (!disposed) setBal(0);
      }
    };

    refresh();

    return () => {
      disposed = true;
      if (ataSubId !== null) connection.removeAccountChangeListener(ataSubId).catch(() => {});
      if (pollId) clearInterval(pollId);
    };
  }, [connection, depsKey]);

  return bal;
}
