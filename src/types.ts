import type { NETWORKS } from "./constants";

export type NodeState = (
  | CheckingState
  | UninitializedState
  | StoppedState
  | StartingState
  | RunningState
) &
  CommonState;
type CheckingState = { status: "checking" };
type UninitializedState = { status: "uninitialized" };
type StoppedState = { status: "stopped" };
type StartingState = {
  status: "starting";
};
type RunningState = {
  status: "running";
  pid: number;
  auth: string;
  state: {
    AccountAddress?: string;
    Balance?: { denom: string; amount: string };
  };
  das: {
    SamplingStats?: {
      head_of_sampled_chain: number;
      head_of_catchup: number;
      network_head_height: number;
      concurrency: number;
      catch_up_done: boolean;
      is_running: boolean;
    };
  };
};

export type CommonState = { network: Network };
export type Network = keyof typeof NETWORKS;
