import { Transition } from "@headlessui/react";
import * as Dialog from "@radix-ui/react-dialog";
import { IconCopy, IconLoader2 } from "@tabler/icons-react";
import { clsx } from "clsx";
import copy from "copy-to-clipboard";
import { useAtomValue, useSetAtom } from "jotai";
import { Fragment, useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DataInput from "../components/DataInput";
import HexInput from "../components/HexInput";
import NumberInput from "../components/NumberInput";
import ReadonlyInput from "../components/ReadonlyInput";
import StringInput from "../components/StringInput";
import { METHODS } from "../constants";
import { useCelestia } from "../hooks/useCelestia";
import { autocompleteAtom, nodeStateAtom } from "../state";
import debug from "../utils/debug";

export default function RPCPage() {
  const nodeState = useAtomValue(nodeStateAtom);

  const runCelestia = useCelestia();

  const [method, setMethod] = useState<{ section: string; command: string }>({
    section: METHODS[0].section,
    command: METHODS[0].commands[0].command,
  });
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<object>({});

  const setAutocomplete = useSetAtom(autocompleteAtom);

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
