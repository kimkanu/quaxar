import { atom } from "jotai";
import type { NodeState } from "./types";

export const nodeStateAtom = atom<NodeState>({
  status: "checking",
  network: "arabica-10",
});
export const dataAtom = atom<string[]>([]);
export const errorAtom = atom<Error[]>([]);
export const autocompleteAtom = atom<Record<string, string[]>>({});
