import { useSyncExternalStore } from "react";
import { localSvgRevision, subscribeLocalSvgs } from "../shared/localSvgSources";
export const useLocalSvgCatalog = () => useSyncExternalStore(subscribeLocalSvgs, localSvgRevision, localSvgRevision);
