/* eslint-disable no-console */

const debug = {
  log(...args: unknown[]) {
    if (import.meta.env.DEV) console.log(...args);
  },
  error(...args: unknown[]) {
    if (import.meta.env.DEV) console.error(...args);
  },
  warn(...args: unknown[]) {
    if (import.meta.env.DEV) console.warn(...args);
  },
  info(...args: unknown[]) {
    if (import.meta.env.DEV) console.info(...args);
  },
};

export default debug;
