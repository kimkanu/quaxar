import * as Progress from "@radix-ui/react-progress";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

let downloadStarted = false;

/**
 * Celestia binary download page
 */
export default function DownloadBinary() {
  const exists = useQuery({
    queryKey: ["exists"],
    queryFn: async () => {
      return window.celestia.exists();
    },
  });

  const [progress, setProgress] = useState({
    percent: 0,
    transferredBytes: 0,
    totalBytes: 100_000_000,
  });

  useEffect(() => {
    const handler = (
      _: unknown,
      percent: number,
      transferredBytes: number,
      totalBytes: number
    ) => {
      setProgress({ percent, transferredBytes, totalBytes });
    };

    // subscribe to download progress
    window.ipcRenderer.on("celestia:download-progress", handler);

    if (!downloadStarted) {
      window.celestia.downloadBinary().then(() => {
        exists.refetch();
      });
      downloadStarted = true;
    }

    return () => {
      // unsubscribe from download progress
      window.ipcRenderer.off("celestia:download-progress", handler);
    };
  }, []);

  return (
    <div className="h-full bg-primary text-white flex flex-col justify-center items-center px-6 gap-8">
      <div className="text-6xl font-bold">
        Qua<span className="text-[#cdb7f8]">X</span>ar
      </div>
      <div className="w-full max-w-lg">
        <Progress.Root
          value={progress.percent * 100}
          className="h-5 w-full overflow-hidden rounded-full bg-white/20 dark:bg-gray-900 p-0.5"
        >
          <Progress.Indicator
            style={{
              width: `${progress.percent * 100}%`,
            }}
            className="h-full bg-white/80 rounded-full duration-300 ease-in-out"
          />
        </Progress.Root>
      </div>
      <div>
        QuaXar is downloading the Celestia binary. This may take a while.
      </div>
    </div>
  );
}
