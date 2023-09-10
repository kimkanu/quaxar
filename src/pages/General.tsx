import * as Progress from "@radix-ui/react-progress";
import { useAtom } from "jotai";
import { useEffect } from "react";
import toast from "react-hot-toast";
import ReadonlyInput from "../components/ReadonlyInput";
import { NETWORKS } from "../constants";
import { useCelestia } from "../hooks/useCelestia";
import { nodeStateAtom } from "../state";

export default function GeneralPage() {
  const [nodeState, setNodeState] = useAtom(nodeStateAtom);

  const runCelestia = useCelestia();

  // fetch required information
  useEffect(() => {
    if (nodeState.status !== "running") return;

    const installCelestiaQuery = (keys: string[], INTERVAL: number) => {
      const query = async () => {
        const response = await runCelestia(
          `celestia:${keys.join("_")}`,
          ["rpc", ...keys, "--auth", nodeState.auth],
          `fetching ${keys.join(" ")}`,
          5000,
          false
        );
        if (!response) {
          return;
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = JSON.parse(response) as { result: any };
          setNodeState((ns) => {
            if (ns.status !== "running") return ns;

            const cloned = structuredClone(ns);

            // for `keys` being ['a','b','c'], `ref` will be ns.a.b
            const ref = keys
              .slice(0, -1)
              .reduce(
                (acc, k) =>
                  acc[k as keyof typeof acc] as Record<string, unknown>,
                cloned as Record<string, unknown>
              );
            // `ref[keys[keys.length - 1]]` will be `ref.c`, which is `ns.a.b.c`
            ref[keys[keys.length - 1]] = json.result;

            console.log(cloned);

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
      installCelestiaQuery(["state", "Balance"], 10_000),
      installCelestiaQuery(["das", "SamplingStats"], 500),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [nodeState.status !== "running"]);

  if (nodeState.status !== "running") return null;

  return (
    <div className="w-full gap-4 h-[calc(100%-7rem)] overflow-y-auto">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Wallet Information</h1>
        <fieldset className="flex items-center gap-4 text-sm">
          <label className="text-white/80" htmlFor="address">
            Account Address
          </label>
          <ReadonlyInput value={nodeState.state.AccountAddress ?? ""} />
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
    </div>
  );
}
