// src/lib/hidden.ts
export const HIDDEN_SOUND_MEMES_LIST: string[] = [
  'FWpLqRiWk8egYjPfscnmpGxPKMqZcxHhASHrfMLDawoo',
  'J7gVKZQFiFGt5XBkWgZ6anHex978Chemp551yVvuMwoo',
  '8GhRMWqLVo1LtDRmFrgnjviZqDoPG74KiusHL4VTPwoo', // broken test
];

// (optional helpers still available if other places rely on them)
export const HIDDEN_SOUND_MEMES = new Set<string>(HIDDEN_SOUND_MEMES_LIST);

export const isHiddenSoundMeme = (addr?: string | null) =>
  !!addr && HIDDEN_SOUND_MEMES.has(addr);
