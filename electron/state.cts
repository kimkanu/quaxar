import type { ChildProcessWithoutNullStreams } from "node:child_process";

export interface State {
  processes: Record<number, ChildProcessWithoutNullStreams>;
}

export const state: State = {
  processes: {},
};
