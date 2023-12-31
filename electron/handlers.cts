/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/consistent-type-imports */
import axios from "axios";
import { type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { arch, platform } from "node:os";
import path from "node:path";
import { State, state } from "./state.cjs";

const BINARY_REPOSITORY =
  "https://github.com/kimkanu/celestia-node/releases/download/v0.11.0-rc12-windows/";

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

const platformToGoos = (platform: string) => {
  switch (platform) {
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "linux";
  }
};

const archToGoarch = (arch: string) => {
  switch (arch) {
    case "x64":
      return "amd64";
    case "x32":
      return "386";
    case "arm":
      return "arm";
    case "arm64":
      return "arm64";
    default:
      return "amd64";
  }
};

const getCelestiaHome = (app: Electron.App) => {
  const home = path.join(app.getPath("userData"), "celestia");
  if (!fs.existsSync(home)) {
    fs.mkdirSync(home, {
      recursive: true,
    });
  }
  return home;
};
const OS_AND_ARCH = `${platformToGoos(platform())}-${archToGoarch(arch())}`;
const BINARY_BASENAME = `celestia-${OS_AND_ARCH}${
  platform() === "win32" ? ".exe" : ""
}`;

/**
 * Code copy-pasted from https://www.npmjs.com/package/make-executable
 */
function makeExecutableSync(path: string) {
  try {
    const stats = fs.statSync(path);
    fs.chmodSync(path, getExecutableMode(stats.mode));
    return true;
  } catch (err) {
    return handleError(err);
  }
}

export function getExecutableMode(mode = 0) {
  return (
    // eslint-disable-next-line no-bitwise
    mode | fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH
  );
}

function handleError(err: any) {
  if (err.code === "ENOENT") {
    return false;
  }
  return undefined;
}

export const handlers = ({
  app,
  mainWindow,
}: typeof import("electron") & { mainWindow: BrowserWindow; state: State }) =>
  ({
    electron: {
      isElectron: () => true,
    },
    celestia: {
      exists: () => {
        return fs.existsSync(path.join(getCelestiaHome(app), BINARY_BASENAME));
      },
      downloadBinary: async () => {
        const PREBUILT_BINARIES = [
          "darwin-amd64",
          "darwin-arm64",
          "linux-amd64",
          "linux-arm",
          "linux-386",
          "linux-arm64",
          "windows-386",
          "windows-amd64",
        ];
        if (!PREBUILT_BINARIES.includes(OS_AND_ARCH)) {
          throw new Error(
            `No prebuilt binaries for ${platform()}-${archToGoarch(arch())}`
          );
        }

        const CELESTIA_HOME = getCelestiaHome(app);

        const { data, headers } = await axios({
          url: `${BINARY_REPOSITORY}${BINARY_BASENAME}`,
          method: "GET",
          responseType: "stream",
        });

        return new Promise<void>((resolve, reject) => {
          let downloadedBytes = 0;
          const contentLength = headers["content-length"];

          data.on("data", (chunk: Buffer) => {
            downloadedBytes += chunk.byteLength;

            mainWindow.webContents.send(
              "celestia:download-progress",
              downloadedBytes / contentLength,
              downloadedBytes,
              contentLength
            );
          });

          data.pipe(
            fs.createWriteStream(
              `${path.join(CELESTIA_HOME, BINARY_BASENAME)}.part`
            )
          );

          data.on("end", () => {
            resolve();

            fs.renameSync(
              `${path.join(CELESTIA_HOME, BINARY_BASENAME)}.part`,
              path.join(CELESTIA_HOME, BINARY_BASENAME)
            );
            makeExecutableSync(path.join(CELESTIA_HOME, BINARY_BASENAME));
          });

          data.on("error", (e: Error) => {
            reject(e);
          });
        });
      },
      run: async (
        _: Electron.IpcMainInvokeEvent,
        channel: string,
        args: string[]
      ) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const CELESTIA_BINARY = path.join(CELESTIA_HOME, BINARY_BASENAME);

        if (!fs.existsSync(CELESTIA_BINARY)) {
          throw new Error("Celestia binary does not exist");
        }

        const promise = new Promise<void>((resolve, reject) => {
          const celestia = spawn(CELESTIA_BINARY, args, {
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
            if (!celestia.killed) {
              celestia.kill("SIGKILL");
            }
          });
        });

        return promise;
      },
      nodeExists: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToNode = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`
        );
        return fs.existsSync(pathToNode);
      },
      keysExists: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToNode = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`,
          "keys"
        );
        return fs.existsSync(pathToNode);
      },
      dataExists: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToNode = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`,
          "data"
        );
        return fs.existsSync(pathToNode);
      },
      removeNode: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToNode = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`
        );
        fs.rmdirSync(pathToNode, { recursive: true });
      },
      removeKeys: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToKeys = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`,
          "keys"
        );
        fs.rmdirSync(pathToKeys, { recursive: true });
      },
      removeData: async (_: Electron.IpcMainInvokeEvent, network: string) => {
        const CELESTIA_HOME = getCelestiaHome(app);
        const pathToData = path.join(
          CELESTIA_HOME,
          `.celestia-light-${network}`,
          "data"
        );
        fs.rmdirSync(pathToData, { recursive: true });
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
