type LogFn = (...args: unknown[]) => void;

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

let enabled =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("nostr-chat:debug") === "true";

/** Enable or disable debug/info logging at runtime. Errors and warnings are always shown. */
export function setDebug(on: boolean) {
  enabled = on;
}

const noop: LogFn = () => {};

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  return {
    get debug() {
      return enabled
        ? (...args: unknown[]) => console.debug(prefix, ...args)
        : noop;
    },
    get info() {
      return enabled
        ? (...args: unknown[]) => console.log(prefix, ...args)
        : noop;
    },
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}
