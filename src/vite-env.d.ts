// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../electron/handlers.cts" />
/// <reference types="vite/client" />

interface Window extends Handlers {
  ipcRenderer: {
    on<R extends unknown[]>(channel: string, fn: (...data: R) => void): void;
    off<R extends unknown[]>(channel: string, fn: (...data: R) => void): void;
    emit<R extends unknown[]>(channel: string, ...data: R): void;
    removeAllListeners(channel: string): void;
  };
  webFrame: {
    setVisualZoomLevelLimits(min: number, max: number): void;
  };
}
