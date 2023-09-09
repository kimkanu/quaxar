import * as electron from "electron";
import { BrowserWindow, app, ipcMain, protocol, shell } from "electron";
import path from "path";

import { handlers } from "./electron/handlers.cjs";
import { state } from "./electron/state.cjs";

async function main() {
  app.whenReady().then(() => {
    protocol.registerFileProtocol("file", (request, callback) => {
      const pathname = decodeURI(request.url.replace("file:///", ""));
      callback(pathname);
    });
  });

  await new Promise((resolve) => {
    app.on("ready", resolve);
  });

  const mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "electron/preload.cjs"),
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      webSecurity: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // mainWindow.once("ready-to-show", () => {});

  const handlersCollection = handlers({ ...electron, mainWindow, state });
  Object.entries(handlersCollection).forEach(([namespace, handlers]) => {
    Object.entries(handlers).forEach(([name, handler]) => {
      ipcMain.handle(`${namespace}:${name}`, handler);
    });
  });

  if (process.env.ENTRY_URL) {
    await mainWindow.loadURL(process.env.ENTRY_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "index.html"));
  }
}

main();
