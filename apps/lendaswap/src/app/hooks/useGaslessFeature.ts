import { useSyncExternalStore } from "react";

const STORAGE_KEY = "gasless";

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/** Returns true when `localStorage.gasless === "true"`. */
export function useGaslessFeature(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
