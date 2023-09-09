import * as Progress from "@radix-ui/react-progress";
import { IconCopy } from "@tabler/icons-react";
import copy from "copy-to-clipboard";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import Button from "../components/Button";
import Celestia from "../components/Celestia";
import { NETWORKS } from "../constants";
import { dataAtom, nodeStateAtom } from "../state";
import debug from "../utils/debug";

type Pages = "general" | "rpc";

export default function RunningPage() {
  const [page, setPage] = useState<Pages>("general");
  const [nodeState, setNodeState] = useAtom(nodeStateAtom);
  const setData = useSetAtom(dataAtom);

  const runCelestia = useCallback(
    async (
      channel: string,
      args: string[],
      errorContext?: string,
      timeoutForRetry = 0,
      retry = true
    ) => {
      debug.log("Running", `\`${args.join(" ")}\``);

      window.celestia.run(channel, args);
      let finished = false;

      try {
        const data = await new Promise<string>((resolve, reject) => {
          const dataHandler = (_: unknown, data: Uint8Array) => {
            resolve(new TextDecoder().decode(data));
            finished = true;
            window.ipcRenderer.off(channel, dataHandler);
            window.ipcRenderer.off("celestia:error", errorHandler);
          };
          const errorHandler = (_: unknown, error: Error) => {
            reject(error);
            finished = true;
            window.ipcRenderer.off(channel, dataHandler);
            window.ipcRenderer.off("celestia:error", errorHandler);
          };
          window.ipcRenderer.on(channel, dataHandler);
          window.ipcRenderer.on("celestia:error", errorHandler);

          if (timeoutForRetry > 0) {
            debug.log("setting timeoutForRetry", timeoutForRetry);
            setTimeout(() => {
              if (!finished) {
                reject(new Error("Timeout"));
              }
            }, timeoutForRetry);
          }
        });
        return data;
      } catch (e) {
        const error = e as Error;

        debug.log(e);

        if (error.message === "Timeout" && retry) {
          debug.log("Timeout, retrying...");
          return runCelestia(channel, args, errorContext, timeoutForRetry);
        }

        toast.error(
          `Error occurred${errorContext ? ` during ${errorContext}` : ""}: ${
            error.message
          }`
        );
        return null;
      }
    },
    []
  );

  // fetch wallet address
  useEffect(() => {
    if (nodeState.status !== "running") return;

    const installCelestiaQuery = (keys: string[], INTERVAL: number) => {
      const query = async () => {
        const response = await runCelestia(
          `celestia:${keys.join("_")}`,
          ["rpc", ...keys, "--auth", nodeState.auth],
          `fetching ${keys.join(" ")}`
        );
        if (!response) {
          toast.error(`Error occurred fetching ${keys.join(" ")}`);
          return;
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = JSON.parse(response) as { result: any };
          setNodeState((ns) => {
            if (ns.status !== "running") return ns;

            const cloned = structuredClone(ns);

            // for keys being ['a','b','c'], this will be ns.a.b
            const ref = keys
              .slice(0, -1)
              .reduce(
                (acc, k) =>
                  acc[k as keyof typeof acc] as Record<string, unknown>,
                cloned as Record<string, unknown>
              );
            ref[keys[keys.length - 1]] = json.result;

            return cloned;
          });
        } catch (e) {
          toast.error(`Error occurred fetching wallet address: ${e}`);
        }
      };

      query();
      const interval = setInterval(() => {
        query();
      }, INTERVAL);

      return () => {
        clearInterval(interval);
      };
    };

    const cleanups = [
      installCelestiaQuery(["state", "AccountAddress"], 10_000),
      installCelestiaQuery(["state", "Balance"], 2_000),
      installCelestiaQuery(["das", "SamplingStats"], 500),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [nodeState.status !== "running"]);

  if (nodeState.status !== "running") return null;

  return (
    <div className="min-h-full h-fit text-white bg-primary flex flex-col gap-6 p-4">
      <div>
        <div className="flex w-full gap-4 items-center">
          <Celestia className="w-12 h-12" />
          <div className="flex flex-col gap-1 justify-center">
            <h1 className="text-2xl font-bold leading-none">
              Light Node Running
            </h1>
            <h2 className="leading-none text-white/80">
              Network: {nodeState.network}
            </h2>
          </div>
          <div className="flex-1" />
          <div>
            <Button
              onClick={async () => {
                if (nodeState.pid) {
                  setData([]);
                  await window.celestia.kill(nodeState.pid);
                }
              }}
              className={clsx(
                "!bg-red-600/80 hover:!bg-red-600 rounded-md text-white transition-[color,background-color,border-color,text-decoration-color,opacity]"
              )}
            >
              Stop
            </Button>
          </div>
        </div>

        <div className="flex translate-y-[18px] mb-2 justify-center gap-2">
          <Button
            onClick={() => setPage("general")}
            className={clsx(
              "rounded-md text-white transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
              page === "general"
                ? "!bg-white text-primary font-medium pointer-events-none"
                : "!bg-white/10 hover:!bg-white/20"
            )}
          >
            General
          </Button>
          <Button
            onClick={() => setPage("rpc")}
            className={clsx(
              "rounded-md text-white transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
              page === "rpc"
                ? "!bg-white text-primary font-medium pointer-events-none"
                : "!bg-white/10 hover:!bg-white/20"
            )}
          >
            RPC
          </Button>
        </div>
      </div>

      {page === "general" && <GeneralPage />}
    </div>
  );
}

function GeneralPage() {
  const nodeState = useAtomValue(nodeStateAtom);

  if (nodeState.status !== "running") return null;

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Wallet Information</h1>
        <fieldset className="flex items-center gap-4 text-sm relative">
          <label className="text-white/80" htmlFor="address">
            Account Address
          </label>
          <input
            readOnly
            className={clsx(
              "block min-w-0 flex-1 rounded-md font-mono px-2.5 py-1.5 pr-10",
              "text-sm text-white placeholder:text-gray-500",
              "border border-white/50 focus-visible:border-transparent",
              "bg-white/20",
              "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75"
            )}
            value={nodeState.state.AccountAddress ?? ""}
          />
          <button
            type="button"
            className="rounded-full transition-colors hover:bg-white/20 flex justify-center items-center absolute top-[3px] right-1 h-7 w-7"
            onClick={() => {
              copy(nodeState.state.AccountAddress ?? "");
              toast.success("Copied!");
            }}
          >
            <IconCopy size={20} />
          </button>
        </fieldset>
        <fieldset className="flex items-center gap-4">
          <label className="text-white/80 text-sm" htmlFor="address">
            Account Balance
          </label>
          <div className="min-w-0 flex-1 text-right h-8 tabular-nums">
            {!nodeState.state.Balance
              ? null
              : nodeState.state.Balance.denom === "utia"
              ? `${(parseFloat(nodeState.state.Balance.amount) * 1e-6).toFixed(
                  6
                )} TIA`
              : `${
                  nodeState.state.Balance.amount
                } ${nodeState.state.Balance.denom.toUpperCase()}`}
          </div>
        </fieldset>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold">DASer Sampling Statistics</h1>
        <fieldset className="flex flex-col">
          <div className="flex justify-between text-sm text-white/80">
            <span>Sampled chain head</span>
            <span>
              {nodeState.das.SamplingStats
                ? `${nodeState.das.SamplingStats.head_of_sampled_chain} (${(
                    (nodeState.das.SamplingStats.head_of_sampled_chain /
                      nodeState.das.SamplingStats.network_head_height) *
                    100
                  ).toFixed(2)}%)`
                : "-"}
            </span>
          </div>
          <div className="my-1">
            <Progress.Root
              value={
                nodeState.das.SamplingStats
                  ? (nodeState.das.SamplingStats.head_of_sampled_chain /
                      nodeState.das.SamplingStats.network_head_height) *
                    100
                  : 0
              }
              className="h-3 w-full overflow-hidden rounded-full bg-white/20 dark:bg-gray-900 p-0.5"
            >
              <Progress.Indicator
                style={{
                  width: `${
                    nodeState.das.SamplingStats
                      ? (nodeState.das.SamplingStats.head_of_sampled_chain /
                          nodeState.das.SamplingStats.network_head_height) *
                        100
                      : 0
                  }%`,
                }}
                className="h-full bg-white/80 rounded-full duration-300 ease-in-out"
              />
            </Progress.Root>
          </div>
        </fieldset>
        <fieldset className="flex flex-col">
          <div className="flex justify-between text-sm text-white/80">
            <span>Catchup head</span>
            <span>
              {nodeState.das.SamplingStats
                ? `${nodeState.das.SamplingStats.head_of_catchup} (${(
                    (nodeState.das.SamplingStats.head_of_catchup /
                      nodeState.das.SamplingStats.network_head_height) *
                    100
                  ).toFixed(2)}%)`
                : "-"}
            </span>
          </div>
          <div className="my-1">
            <Progress.Root
              value={
                nodeState.das.SamplingStats
                  ? (nodeState.das.SamplingStats.head_of_catchup /
                      nodeState.das.SamplingStats.network_head_height) *
                    100
                  : 0
              }
              className="h-3 w-full overflow-hidden rounded-full bg-white/20 dark:bg-gray-900 p-0.5"
            >
              <Progress.Indicator
                style={{
                  width: `${
                    nodeState.das.SamplingStats
                      ? (nodeState.das.SamplingStats.head_of_catchup /
                          nodeState.das.SamplingStats.network_head_height) *
                        100
                      : 0
                  }%`,
                }}
                className="h-full bg-white/80 rounded-full duration-300 ease-in-out"
              />
            </Progress.Root>
          </div>
        </fieldset>
        <fieldset className="flex flex-col">
          <div className="flex justify-between text-sm text-white/80">
            <span>Network head height</span>
            <span>
              {nodeState.das.SamplingStats
                ? nodeState.das.SamplingStats.network_head_height
                : "-"}{" "}
              (100.00%)
            </span>
          </div>
          <div className="my-1">
            <Progress.Root
              value={100}
              className="h-3 w-full overflow-hidden rounded-full bg-white/20 dark:bg-gray-900 p-0.5"
            >
              <Progress.Indicator
                style={{ width: `${100.0}%` }}
                className="h-full bg-white/80 rounded-full duration-300 ease-in-out"
              />
            </Progress.Root>
          </div>
        </fieldset>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold">Useful Links</h1>
        {NETWORKS[nodeState.network].usefulLinks.map((link) => (
          <fieldset
            key={link.url}
            className="flex items-center gap-4 relative justify-between"
          >
            <span className="text-white/80 text-sm">{link.name}</span>
            <a
              target="_blank"
              rel="noreferrer"
              href={link.url}
              className="text-white underline hover:drop-shadow-[0_0_4px_#fff] transition-[filter]"
            >
              {link.text}
            </a>
          </fieldset>
        ))}
      </div>
    </>
  );
}
