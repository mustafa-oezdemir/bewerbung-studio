/** The selectable designs of the Deckblatt. The registry with names and markup lives in `deckblattDesigns.ts`. */
export const deckblattDesignIds = ["klassisch", "pastell", "akzentband", "farbbalken", "seitenpanel"] as const;
export type DeckblattDesignId = (typeof deckblattDesignIds)[number];
export const defaultDeckblattDesign: DeckblattDesignId = "klassisch";
