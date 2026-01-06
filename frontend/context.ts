import { createContext } from "preact";
import { Dispatch } from "preact/hooks";
import { Item, State, StateUpdate } from "./types.ts";

export const LibraryContext = createContext<Item[]>([]);
export const StateContext = createContext<[State, Dispatch<StateUpdate>]>(
  undefined!,
);
