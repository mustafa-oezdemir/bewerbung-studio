/** Optional in-memory test seam for application change notifications. */
export type ApplicationGitAction =
  | "create"
  | "bewerbung"
  | "update"
  | "delete"
  | "absage"
  | "vorstellungsgespraech"
  | "anschreiben";

export interface ApplicationGitCommitQueue {
  queueCommit(companyName: string, action: ApplicationGitAction): void;
}
