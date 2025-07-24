import { useEffect, useState } from 'react';

export function useSoundMemeBalances() {
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('woodeng::sound-meme::balances');
      if (raw) setBalances(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  return balances;
}
