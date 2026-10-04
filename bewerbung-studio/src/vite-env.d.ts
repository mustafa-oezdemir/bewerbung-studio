/// <reference types="vite/client" />

import type { BewerbungsManagerApi } from "./shared/ipc";

declare global {
  interface Window {
    bewerbungsManager: BewerbungsManagerApi;
  }
}

export {};
