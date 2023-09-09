import { Transition } from "@headlessui/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconLoader2,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import copy from "copy-to-clipboard";
import { useAtom, useSetAtom } from "jotai";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import Button from "./components/Button";
import Celestia from "./components/Celestia";
import { NETWORKS } from "./constants";
import { dataAtom, errorAtom, nodeStateAtom } from "./state";
import type { Network } from "./types";
import debug from "./utils/debug";
import RunningPage from "./pages";

export default function App() {
  const [nodeState, setNodeState] = useAtom(nodeStateAtom);
  const [data, setData] = useAtom(dataAtom);
  const setErrors = useSetAtom(errorAtom);
  const pid = useRef(-1);

  const [isNodeInitializationDialogOpen, setIsNodeInitializationDialogOpen] =
    useState(false);
  const [nodeInitializationData, setNodeInitializationData] = useState<
    { NAME: string; ADDRESS: string; MNEMONIC: string } | undefined
  >(undefined);

  const nodeExists = useQuery({
    queryKey: ["nodeExists", nodeState.network],
    queryFn: async () => {
      return window.celestia.nodeExists(nodeState.network);
    },
  });

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

  // XXX: remove hot reload artifacts
  useEffect(() => {
    setData([]);
    window.ipcRenderer.removeAllListeners("celestia:data");
    window.ipcRenderer.removeAllListeners("celestia:error");
    window.ipcRenderer.removeAllListeners("celestia:pid");
  }, []);

  useEffect(() => {
    if (!data[0]) return;
    if (nodeState.status === "starting") {
      // starting and got the first data
      runCelestia(
        "celestia:auth",
        [
          "light",
          "auth",
          "admin",
          "--p2p.network",
          NETWORKS[nodeState.network].network,
        ],
        "authorization",
        1000
      ).then((auth) => {
        if (!auth) {
          setNodeState((ns) => ({
            network: ns.network,
            status: "stopped",
          }));
          return;
        }

        setNodeState((ns) => ({
          network: ns.network,
          pid: pid.current,
          auth,
          status: "running",
          state: {},
          das: {},
        }));
      });
    }
  }, [data[0], nodeState.status, runCelestia]);

  useEffect(() => {
    setNodeState((ns) => ({ network: ns.network, status: "checking" }));
  }, [nodeState.network]);

  useEffect(() => {
    if (nodeState.status !== "checking") return;

    if (nodeExists.data === true) {
      setNodeState((ns) => ({ network: ns.network, status: "stopped" }));
    } else if (nodeExists.data === false) {
      setNodeState((ns) => ({ network: ns.network, status: "uninitialized" }));
    }
  }, [nodeExists.data, nodeState.status]);

  useEffect(() => {
    const dataHandler = (_: unknown, buffer: Uint8Array) => {
      const data = new TextDecoder().decode(buffer);
      setData((d) => [data, ...d]);
    };
    const errorHandler = (_: unknown, error: Error) => {
      setErrors((d) => [error, ...d]);
      toast.error(error.message);
    };
    window.ipcRenderer.on("celestia:data", dataHandler);
    window.ipcRenderer.on("celestia:error", errorHandler);

    return () => {
      window.ipcRenderer.off("celestia:data", dataHandler);
      window.ipcRenderer.off("celestia:error", errorHandler);
    };
  }, []);

  return nodeState.status !== "running" ? (
    <div className="min-h-full h-fit relative text-white bg-primary flex flex-col justify-center items-center gap-8 py-24">
      <button
        disabled={
          nodeState.status === "checking" || nodeState.status === "starting"
        }
        className="group disabled:pointer-events-none select-none"
        onClick={async () => {
          if (
            nodeState.status === "checking" ||
            nodeState.status === "starting"
          ) {
            return;
          }

          if (nodeState.status === "uninitialized") {
            // Create node
            const data = await runCelestia(
              "celestia:init",
              [
                "light",
                "init",
                "--p2p.network",
                NETWORKS[nodeState.network].network,
              ],
              "initialization"
            );
            if (data === null) return;

            const nodeInitializationData = data
              .replace(/: \n/, ": ")
              .split("\n")
              .filter((x) => x)
              .map((x) => x.split(": "))
              .reduce(
                (acc, [k, v]) => ({ ...acc, [k.split(" ")[0]]: v }),
                {} as Record<string, string>
              ) as { NAME: string; ADDRESS: string; MNEMONIC: string };

            setNodeInitializationData(nodeInitializationData);
            setIsNodeInitializationDialogOpen(true);
            setNodeState((ns) => ({ network: ns.network, status: "stopped" }));
            nodeExists.refetch();
          } else {
            // Run node
            setNodeState((ns) => ({ network: ns.network, status: "starting" }));
            window.celestia
              .run("celestia:data", [
                "light",
                "start",
                "--core.ip",
                NETWORKS[nodeState.network].coreIp,
                "--p2p.network",
                NETWORKS[nodeState.network].network,
              ])
              .catch((e) => {
                toast.error(`Error occurred starting the node: ${e}`);
              })
              .finally(() => {
                setNodeState((ns) => ({
                  network: ns.network,
                  status: "stopped",
                }));
              });

            debug.log("awaiting pid");
            pid.current = await new Promise<number>((resolve) => {
              const pidHandler = (_: unknown, pid: number) => {
                resolve(pid);
                window.ipcRenderer.off("celestia:pid", pidHandler);
              };
              window.ipcRenderer.on("celestia:pid", pidHandler);
            });
            debug.log("got pid", pid.current);
          }
        }}
      >
        <div className="flex gap-y-4 flex-col items-center">
          {nodeState.status === "checking" ||
          nodeState.status === "starting" ? (
            <div className="w-40 h-40 flex justify-center items-center text-white/70">
              <IconLoader2 size={96} className="animate-spin" />
            </div>
          ) : (
            <Celestia
              className={clsx(
                "w-40 h-40 group-hover:drop-shadow-[0_0_30px_#f8f] transition-[filter] duration-500",
                ""
              )}
            />
          )}
          <span
            className="
              text-4xl 
              group-hover:drop-shadow-[0_0_15px_#f8f]
              transition-[filter]
              duration-500
            "
          >
            {
              (
                {
                  checking: "Checking if node exists...",
                  uninitialized: "Create Light Node",
                  stopped: "Run Light Node",
                  starting: "Starting Light Node...",
                  running: "Light node is running",
                } as const
              )[nodeState.status]
            }
          </span>
        </div>
      </button>
      <div className="flex items-center gap-4">
        <span className="text-white/80">Network</span>
        <Select.Root
          disabled={nodeState.status === "starting"}
          value={nodeState.network}
          onValueChange={(network: Network) => {
            if (nodeState.status === "starting") return;
            setNodeState((ns) => ({ ...ns, network }));
          }}
        >
          <Select.Trigger asChild aria-label="Network">
            <Button className="min-w-[12rem] flex">
              <span className="flex-1 min-w-0">
                <Select.Value />
              </span>
              <Select.Icon className="ml-2 shrink-0">
                <IconChevronDown />
              </Select.Icon>
            </Button>
          </Select.Trigger>
          <Select.Content>
            <Select.ScrollUpButton className="flex items-center justify-center text-gray-700">
              <IconChevronUp />
            </Select.ScrollUpButton>
            <Select.Viewport className="bg-white p-2 rounded-lg shadow-lg">
              <Select.Group>
                {Object.keys(NETWORKS).map((f) => (
                  <Select.Item
                    key={f}
                    value={f.toLowerCase()}
                    className={clsx(
                      "relative flex items-center px-8 py-2 rounded-md text-sm text-gray-700 font-medium focus:bg-gray-100",
                      "radix-disabled:opacity-50",
                      "focus:outline-none select-none"
                    )}
                  >
                    <Select.ItemText>{f}</Select.ItemText>
                    <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                      <IconCheck />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Viewport>
            <Select.ScrollDownButton className="flex items-center justify-center text-gray-700">
              <IconChevronDown />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Root>
      </div>

      <Button
        className={clsx(
          "!bg-red-600/80 hover:!bg-red-600 rounded-md text-white absolute bottom-8 transition-[color,background-color,border-color,text-decoration-color,opacity]",
          nodeState.status === "stopped"
            ? "!opacity-100"
            : "!opacity-0 pointer-events-none"
        )}
      >
        Delete Node Data
      </Button>

      <NodeInitializationDialog
        network={nodeState.network}
        isOpen={isNodeInitializationDialogOpen}
        setIsOpen={setIsNodeInitializationDialogOpen}
        data={nodeInitializationData}
      />
    </div>
  ) : (
    <RunningPage />
  );
}

function NodeInitializationDialog({
  network,
  isOpen,
  setIsOpen,
  data,
}: {
  network: Network;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  data?: { NAME: string; ADDRESS: string; MNEMONIC: string };
}) {
  const [isCloseDisabled, setIsCloseDisabled] = useState(false);

  // when opened, disable close button for 3 seconds
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (isOpen) {
      setIsCloseDisabled(true);
      timeout = setTimeout(() => {
        setIsCloseDisabled(false);
      }, 3000);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
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
                "w-[95vw] max-w-md rounded-lg p-4 md:w-full",
                "top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]",
                "bg-white",
                "focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75"
              )}
            >
              <Dialog.Title className="text-xl font-bold text-gray-900">
                Your node on {network} has been created!
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal text-red-900 bg-red-300 border-2 rounded-lg border-red-600 px-3 py-2">
                <span className="font-bold">EXTREMELY IMPORTANT</span>: Please
                save the <span className="font-bold">MNEMONIC</span> shown below
                in a secure place.
              </Dialog.Description>
              <form className="mt-2 space-y-2">
                <fieldset>
                  <label
                    htmlFor="name"
                    className="text-xs font-medium text-gray-700"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Name"
                    value={data?.NAME}
                    readOnly
                    className={clsx(
                      "block w-full rounded-md font-mono px-2.5 py-1.5",
                      "text-sm text-gray-900 placeholder:text-gray-500",
                      "border border-gray-400 focus-visible:border-transparent",
                      "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75"
                    )}
                  />
                </fieldset>
                <fieldset>
                  <label
                    htmlFor="address"
                    className="text-xs font-medium text-gray-700"
                  >
                    Address
                  </label>
                  <div className="w-full relative">
                    <input
                      id="address"
                      type="text"
                      placeholder="Address"
                      value={data?.ADDRESS}
                      readOnly
                      className={clsx(
                        "block w-full rounded-md font-mono px-2.5 py-1.5 pr-10",
                        "text-sm text-gray-900 placeholder:text-gray-500",
                        "border border-gray-400 focus-visible:border-transparent",
                        "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75"
                      )}
                    />
                    <button
                      type="button"
                      className="rounded-full transition-colors hover:bg-gray-200 flex justify-center items-center absolute top-[3px] right-1 h-7 w-7"
                      onClick={() => {
                        copy(data?.ADDRESS || "");
                        toast.success("Copied!");
                      }}
                    >
                      <IconCopy size={20} />
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <label
                    htmlFor="mnemonic"
                    className="text-xs font-bold text-red-600"
                  >
                    MNEMONIC (Be sure to save this in a secure place!)
                  </label>
                  <div className="w-full relative">
                    <input
                      id="mnemonic"
                      type="text"
                      placeholder="Mnemonic"
                      value={data?.MNEMONIC}
                      readOnly
                      className={clsx(
                        "block w-full rounded-md font-mono px-2.5 py-1.5 pr-10",
                        "text-sm text-gray-900 placeholder:text-gray-500",
                        "border border-gray-400 focus-visible:border-transparent",
                        "focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75"
                      )}
                    />
                    <button
                      type="button"
                      className="rounded-full transition-colors hover:bg-gray-200 flex justify-center items-center absolute top-[3px] right-1 h-7 w-7"
                      onClick={() => {
                        copy(data?.MNEMONIC || "");
                        toast.success("Copied!");
                      }}
                    >
                      <IconCopy size={20} />
                    </button>
                  </div>
                </fieldset>
              </form>

              <div className="mt-4 flex justify-end">
                <Dialog.Close
                  disabled={isCloseDisabled}
                  className={clsx(
                    "inline-flex select-none justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400",
                    "border border-transparent",
                    "focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75"
                  )}
                >
                  I saved my mnemonic
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Transition.Child>
        </Transition.Root>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
