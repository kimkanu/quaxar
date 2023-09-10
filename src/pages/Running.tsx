import { clsx } from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import Button from "../components/Button";
import Celestia from "../components/Celestia";
import { dataAtom, nodeStateAtom } from "../state";
import GeneralPage from "./General";
import RPCPage from "./RPC";

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
