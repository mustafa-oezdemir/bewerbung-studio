import { profileSchema } from "../src/shared/schema";
import type { DataStore } from "./storage";

/** Synthetic source for DataStore tests that create applications. */
export const addSyntheticProfile = (store: DataStore) =>
  store.saveProfile(profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true,
    firstName: "Fiktiv", lastName: "Person", updatedAt: new Date().toISOString(),
  }));
