import { createContext } from "preact";
import { Item, HistoryItem, Player } from "./types.ts";

export const LibraryContext = createContext<Item[]>([]);
export const HistoryContext = createContext<HistoryItem[]>([]);
export const PlayerContext = createContext<Player>(undefined!);
