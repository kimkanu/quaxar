import { Transition } from "@headlessui/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { IconCopy, IconLoader2 } from "@tabler/icons-react";
import { clsx } from "clsx";
import copy from "copy-to-clipboard";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Fragment, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import Celestia from "../components/Celestia";
import DataInput from "../components/DataInput";
import HexInput from "../components/HexInput";
import NumberInput from "../components/NumberInput";
import ReadonlyInput from "../components/ReadonlyInput";
import StringInput from "../components/StringInput";
import { METHODS, NETWORKS } from "../constants";
import { autocompleteAtom, dataAtom, nodeStateAtom } from "../state";
import debug from "../utils/debug";

type Pages = "general" | "rpc";

export default function RunningPage() {
  const [page, setPage] = useState<Pages>("general");
  const nodeState = useAtomValue(nodeStateAtom);
  const setData = useSetAtom(dataAtom);

  if (nodeState.status !== "running") return null;

  return (
    <div className="h-full text-white bg-primary flex flex-col gap-6 p-4 justify-stretch">
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
              "rounded-md transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
              page === "general"
                ? "!bg-white text-primary font-medium pointer-events-none"
                : "!bg-white/10 hover:!bg-white/20 text-white"
            )}
          >
            General
          </Button>
          <Button
            onClick={() => setPage("rpc")}
            className={clsx(
              "rounded-md transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
              page === "rpc"
                ? "!bg-white text-primary font-medium pointer-events-none"
                : "!bg-white/10 hover:!bg-white/20 text-white"
            )}
          >
            RPC
          </Button>
        </div>
      </div>

      {page === "general" && <GeneralPage />}
      {page === "rpc" && <RPCPage />}
    </div>
  );
}

export function GeneralPage() {
  const [nodeState, setNodeState] = useAtom(nodeStateAtom);

  const runCelestia = useCallback(
    (
      channel: string,
      args: string[],
      errorContext?: string,
      timeoutForRetry = 0,
      retry = true
    ) =>
      new Promise<string | null>((resolve, reject) => {
        window.celestia.run(channel, args).catch(reject);
        let finished = false;

        try {
          new Promise<string>((resolve, reject) => {
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
              setTimeout(() => {
                if (!finished) {
                  reject(new Error("Timeout"));
                }
              }, timeoutForRetry);
            }
          }).then(resolve);
        } catch (e) {
          const error = e as Error;

          debug.log(e);

          if (error.message === "Timeout" && retry) {
            debug.log("Timeout, retrying...");
            runCelestia(channel, args, errorContext, timeoutForRetry)
              .then(resolve)
              .catch(reject);
          }

          if (error.message !== "Timeout") {
            toast.error(
              `Error occurred${
                errorContext ? ` during ${errorContext}` : ""
              }: ${error.message}`
            );
          }
          resolve(null);
        }
      }),
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

export function RPCPage() {
  const nodeState = useAtomValue(nodeStateAtom);

  const runCelestia = useCallback(
    (
      channel: string,
      args: string[],
      errorContext?: string,
      timeoutForRetry = 0,
      retry = true
    ) =>
      new Promise<string | null>((resolve, reject) => {
        window.celestia.run(channel, args).catch(reject);
        let finished = false;

        try {
          new Promise<string>((resolve, reject) => {
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
              setTimeout(() => {
                if (!finished) {
                  reject(new Error("Timeout"));
                }
              }, timeoutForRetry);
            }
          }).then(resolve);
        } catch (e) {
          const error = e as Error;

          debug.log(e);

          if (error.message === "Timeout" && retry) {
            debug.log("Timeout, retrying...");
            runCelestia(channel, args, errorContext, timeoutForRetry)
              .then(resolve)
              .catch(reject);
          }

          if (error.message !== "Timeout") {
            toast.error(
              `Error occurred${
                errorContext ? ` during ${errorContext}` : ""
              }: ${error.message}`
            );
          }
          resolve(null);
        }
      }),
    []
  );

  const [method, setMethod] = useState<{ section: string; command: string }>({
    section: METHODS[0].section,
    command: METHODS[0].commands[0].command,
  });
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<object>({});

  const [autocomplete, setAutocomplete] = useAtom(autocompleteAtom);

  useEffect(() => {
    debug.log(result);
  }, [result]);
  useEffect(() => {
    debug.log(autocomplete);
  }, [autocomplete]);

  useEffect(() => {
    setResult({});
  }, [method]);

  return (
    <div
      className={clsx(
        "w-full flex gap-4 h-[calc(100%-7rem)]",
        isSending && "cursor-wait [&>div]:pointer-events-none"
      )}
    >
      <div className="w-48 overflow-y-auto rounded-lg border border-white/50 bg-white/10 px-3 py-2 space-y-4 h-full">
        {METHODS.map((m) => (
          <section key={m.section} className="space-y-1">
            <h2 className="text-sm font-bold">{m.section}</h2>
            {m.commands.map((c) => (
              <Button
                key={c.command}
                onClick={() =>
                  setMethod({ section: m.section, command: c.command })
                }
                className={clsx(
                  "w-full !justify-start rounded-md transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
                  method.section === m.section && method.command === c.command
                    ? "!bg-white text-primary font-medium pointer-events-none"
                    : "!bg-white/10 hover:!bg-white/20 text-white"
                )}
              >
                {c.command}
              </Button>
            ))}
          </section>
        ))}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <form
          key={`${method.section}:${method.command}`}
          className="space-y-4 text-center"
          onSubmit={async (e) => {
            if (nodeState.status !== "running") return;

            e.preventDefault();
            setIsSending(true);

            try {
              const formData = new FormData(e.target as HTMLFormElement);
              const command = METHODS.find(
                (m) => m.section === method.section
              )?.commands.find((c) => c.command === method.command);
              if (!command) return;

              const { params } = command;

              const parameters = params.map(
                (param) => formData.get(param.name) as string
              );

              debug.log([
                "rpc",
                method.section,
                method.command,
                ...parameters,
                "--auth",
                nodeState.auth,
              ]);

              const json = await runCelestia(
                `celestia:${method.section}_${method.command}`,
                [
                  "rpc",
                  method.section,
                  method.command,
                  ...parameters,
                  "--auth",
                  nodeState.auth,
                ],
                `fetching ${method.section} ${method.command}`,
                30_000,
                false
              ).catch((e) => {
                toast.error(e.message);
                throw e;
              });
              if (!json) throw new Error("No response");
              const { result } = JSON.parse(json);

              if (result.code) {
                toast.error(
                  <div className="w-full">
                    Error occurred: {result.message ?? ""}
                    <pre className="text-xs mono whitespace-pre block overflow-x-auto w-full">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                );
              } else {
                setResult(result);

                setAutocomplete((ac) => {
                  const newAc = structuredClone(ac);

                  const results = normalizeResult(
                    result,
                    METHODS.find((m) => m.section === method.section)
                      ?.commands.find((c) => c.command === method.command)
                      ?.response.at(0)?.name ?? ""
                  );
                  results.forEach((result) => {
                    command.params.forEach((p) => {
                      if (p.autocomplete && formData.get(p.name)) {
                        newAc[p.autocomplete] = [
                          ...new Set([
                            formData.get(p.name) as string,
                            ...(newAc[p.autocomplete] ?? []),
                          ]),
                        ];
                      }
                    });
                    command.response.forEach((p) => {
                      if (p.autocomplete && result[p.name]) {
                        newAc[p.autocomplete] = [
                          ...new Set([
                            result[p.name].toString(),
                            ...(newAc[p.autocomplete] ?? []),
                          ]),
                        ];
                      }
                    });
                  });

                  return newAc;
                });
              }
            } catch (e) {
              debug.error(e);
            } finally {
              setIsSending(false);
            }
          }}
        >
          <h2 className="text-lg font-bold leading-tight mb-2 text-left">
            Parameters
          </h2>
          <section className="space-y-1">
            {METHODS.find((m) => m.section === method.section)
              ?.commands.find((c) => c.command === method.command)
              ?.params.map((param) => (
                <fieldset key={param.name} className="flex items-center gap-4">
                  <label
                    className="text-white/80 text-sm w-32 text-right"
                    htmlFor={param.name}
                  >
                    {param.name}
                  </label>
                  {param.type === "hex" ? (
                    <HexInput
                      id={param.name}
                      name={param.name}
                      placeholder={param.name}
                      autocompleteKey={param.autocomplete}
                      required
                    />
                  ) : param.type === "data" ? (
                    <DataInput
                      id={param.name}
                      name={param.name}
                      placeholder={param.name}
                      autocompleteKey={param.autocomplete}
                      required
                    />
                  ) : param.type === "number" ? (
                    <NumberInput
                      id={param.name}
                      name={param.name}
                      placeholder={param.name}
                      autocompleteKey={param.autocomplete}
                      required
                    />
                  ) : param.type === "string" ? (
                    <StringInput
                      id={param.name}
                      name={param.name}
                      placeholder={param.name}
                      autocompleteKey={param.autocomplete}
                      required
                    />
                  ) : null}
                </fieldset>
              ))}
          </section>

          <Button
            type="submit"
            className={clsx(
              "rounded-md transition-[color,background-color,border-color,text-decoration-color,opacity] !px-2.5 !py-1.5",
              "!bg-white hover:!bg-white/90 active:!bg-white/80 text-primary font-medium"
            )}
          >
            {isSending ? (
              <IconLoader2 size={20} className="animate-spin" />
            ) : (
              "Send Transaction"
            )}
          </Button>
        </form>

        <div className="space-y-4 mt-8">
          <h2 className="text-lg font-bold leading-tight mb-2 text-left">
            Response
          </h2>
          {normalizeResult(
            result,
            METHODS.find((m) => m.section === method.section)
              ?.commands.find((c) => c.command === method.command)
              ?.response.at(0)?.name ?? ""
          ).map((result, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <section key={i} className="space-y-1">
              {METHODS.find((m) => m.section === method.section)
                ?.commands.find((c) => c.command === method.command)
                ?.response.map((response) => (
                  <fieldset
                    key={response.name}
                    className="flex items-center gap-4"
                  >
                    <label
                      className="text-white/80 text-sm w-32 text-right truncate"
                      htmlFor={response.name}
                    >
                      {response.name}
                    </label>
                    {response.type === "[]string" ? (
                      <div className="border-l border-white/50 pl-1 flex-1 space-y-1">
                        {!(
                          result[
                            response.name as keyof typeof result
                          ] as string[]
                        )?.length ? (
                          <ReadonlyInput
                            // eslint-disable-next-line react/no-array-index-key
                            key={i}
                            value=""
                          />
                        ) : (
                          (
                            result[
                              response.name as keyof typeof result
                            ] as string[]
                          )?.map((x, i) => (
                            <ReadonlyInput
                              className="w-full"
                              // eslint-disable-next-line react/no-array-index-key
                              key={i}
                              value={x ?? ""}
                            />
                          ))
                        )}
                      </div>
                    ) : response.type === "json" ? (
                      <JSONDisplay
                        value={
                          result[response.name as keyof typeof result] ===
                          undefined
                            ? ""
                            : JSON.stringify(
                                result[response.name as keyof typeof result],
                                null,
                                2
                              )
                        }
                      />
                    ) : (
                      <ReadonlyInput
                        className="w-full"
                        value={
                          result[response.name as keyof typeof result] ?? ""
                        }
                      />
                    )}
                  </fieldset>
                ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizeResult(result: unknown, firstKey: string) {
  return (Array.isArray(result) ? result : [result]).map((result) =>
    typeof result === "object" ? result : { [firstKey]: result }
  );
}

function JSONDisplay({ value }: { value: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild disabled={!value}>
        <button
          className={clsx(
            "block flex-1 min-w-0 rounded-md font-mono px-2.5 py-1.5 pr-10 select-none",
            "text-sm text-white placeholder:text-white/60 text-left truncate",
            "border border-white/50 focus-visible:border-transparent min-h-[34px]",
            "bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors cursor-pointer",
            "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75"
          )}
        >
          {value.replace(/\n\s*/g, " ")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal forceMount>
        <Transition.Root show={isOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay
              forceMount
              className="fixed inset-0 z-20 bg-black/50"
            />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Content
              forceMount
              className={clsx(
                "fixed z-50",
                "w-[95vw] max-w-xl rounded-lg p-4 md:w-full",
                "max-h-[90vh] overflow-auto",
                "top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]",
                "bg-white",
                "focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75"
              )}
            >
              <pre className="font-mono whitespace-pre text-sm leading-tight">
                {value}
              </pre>
              <button
                type="button"
                className="rounded-full transition-colors hover:bg-gray-200 flex justify-center items-center fixed top-[3px] right-1 h-7 w-7"
                onClick={() => {
                  copy(value);
                  toast.success("Copied!");
                }}
              >
                <IconCopy size={20} />
              </button>
            </Dialog.Content>
          </Transition.Child>
        </Transition.Root>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
