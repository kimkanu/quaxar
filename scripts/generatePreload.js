import fs from "node:fs";
import * as pkg from "../build/electron/handlers.cjs";

const { handlers } = pkg;

const handlerKeys = JSON.stringify(
  Object.fromEntries(
    Object.entries(handlers({})).map(([namespace, namespacedHandlers]) => [
      namespace,
      Object.keys(namespacedHandlers),
    ])
  )
);

const PRELOAD_SOURCE = `/* Do not modify this file! It is auto-generated by scripts/generatePreload.js. */

import { contextBridge, ipcRenderer, webFrame } from "electron";

const _handlers = ${handlerKeys};

// eslint-disable-next-line no-restricted-syntax
for (const namespace of Object.keys(_handlers)) {
  contextBridge.exposeInMainWorld(
    namespace,
    Object.fromEntries(
      _handlers[namespace as keyof typeof _handlers].map(
        (name) => [
          name,
          (...args: unknown[]) => ipcRenderer.invoke(\`\${namespace}:\${name}\`, ...args),
        ],
      ),
    ),
  );
}
contextBridge.exposeInMainWorld(
  "ipcRenderer",
  {
    on(channel: string, fn: (...data: unknown[]) => void) {
      ipcRenderer.on(channel, fn);
    },
    off(channel: string, fn: (...data: unknown[]) => void) {
      ipcRenderer.off(channel, fn);
    },
    emit(channel: string, ...data: unknown[]) {
      ipcRenderer.emit(channel, ...data);
    },
    removeAllListeners(channel: string) {
      ipcRenderer.removeAllListeners(channel)
    },
  }
);
contextBridge.exposeInMainWorld(
  "webFrame",
  {
    setVisualZoomLevelLimits(min: number, max: number) {
      webFrame.setVisualZoomLevelLimits(min, max);
    },
  }
);
`;

fs.writeFileSync("electron/preload.cts", PRELOAD_SOURCE);
