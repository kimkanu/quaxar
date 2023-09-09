/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/consistent-type-imports */

import { type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { platform, arch } from "node:os";
import path from "node:path";
import { State, state } from "./state.cjs";

const debug = {
  log(...args: unknown[]) {
    if (process.env.NODE_ENV === "development") console.log(...args);
  },
  error(...args: unknown[]) {
    if (process.env.NODE_ENV === "development") console.error(...args);
  },
  warn(...args: unknown[]) {
    if (process.env.NODE_ENV === "development") console.warn(...args);
  },
  info(...args: unknown[]) {
    if (process.env.NODE_ENV === "development") console.info(...args);
  },
};

export const handlers = ({
  app,
  mainWindow,
}: typeof import("electron") & { mainWindow: BrowserWindow; state: State }) =>
  ({
    electron: {
      isElectron: () => true,
      getAppPath: () => app.getAppPath(),
      getUserDataPath: () => app.getPath("userData"),
    },
    celestia: {
      run: async (
        _: Electron.IpcMainInvokeEvent,
        channel: string,
        args: string[]
      ) => {
        if (!require.main) {
          throw new Error("require.main is undefined");
        }
        // TODO: packaged app?
        const CELESTIA_HOME = app.getAppPath();
        const binariesPath = path.join(
          app.getAppPath(),
          "bin",
          platform(),
          arch()
        );

        debug.log(binariesPath);

        const promise = new Promise<void>((resolve, reject) => {
          const celestia = spawn(path.join(binariesPath, "celestia"), args, {
            env: {
              HOME: app.getPath("home"),
              CELESTIA_HOME,
            },
          });
          const pid = celestia.pid ?? 0;
          state.processes[pid] = celestia;

          mainWindow.webContents.send("celestia:pid", pid);
          const interval = setInterval(() => {
            mainWindow.webContents.send("celestia:pid", pid);
          }, 1000);

          celestia.stdout.on("data", (data) => {
            debug.log(`stdout: ${data}`);
            mainWindow.webContents.send(channel, data);
          });

          celestia.stderr.on("error", (error) => {
            debug.error(`stderr: ${error}`);
            mainWindow.webContents.send("celestia:error", {
              name: error.name,
              message: error.message,
              stack: error.stack,
            });
          });

          celestia.on("close", (code, signal) => {
            if (!code || signal === "SIGKILL") {
              debug.log("RESOLVED");
              resolve();
            } else {
              debug.log("REJECTED");
              reject(code);
            }
            delete state.processes[pid];
            clearInterval(interval);
          });
        });

        return promise;
      },
      nodeExists: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        // TODO: packaged app?
        const CELESTIA_HOME = app.getAppPath();
        const pathToNode = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`
        );
        return fs.existsSync(pathToNode);
      },
      kill: async (_: Electron.IpcMainInvokeEvent, pid: number) => {
        state.processes[pid].kill("SIGKILL");
        return pid;
      },
    },
  } as const);

/** type definitions */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typechecker: (
  electron: typeof import("electron") & {
    mainWindow: BrowserWindow;
    state: State;
  }
) => GeneralHandlers = handlers;
type GeneralHandlers = {
  [namespace: string]: {
    [name: string]: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any;
  };
};
type ClientSide<H extends GeneralHandlers> = {
  [namespace in keyof H]: {
    [name in keyof H[namespace]]: H[namespace][name] extends (
      e: any,
      ...args: infer A
    ) => Promise<infer R>
      ? (...args: A) => Promise<R>
      : H[namespace][name] extends () => Promise<infer R>
      ? () => Promise<R>
      : H[namespace][name] extends (e: unknown, ...args: infer A) => infer R
      ? (...args: A) => Promise<R>
      : H[namespace][name] extends () => infer R
      ? () => Promise<R>
      : never;
  };
};
declare global {
  type Handlers = ClientSide<ReturnType<typeof handlers>>;
}
