import { createContext } from "preact";
import { Dispatch, StateUpdater } from "preact/hooks";
import { Item, State, Player } from "./types.ts";

export const LibraryContext = createContext<Item[]>([]);
export const StateContext = createContext<
  [State, Dispatch<StateUpdater<State>>]
>(undefined!);
export const PlayerContext = createContext<Player>(undefined!);
