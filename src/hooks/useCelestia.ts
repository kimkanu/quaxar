import { useCallback } from "react";
import toast from "react-hot-toast";
import debug from "../utils/debug";

export function useCelestia() {
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

  return runCelestia;
}
