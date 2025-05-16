export interface IContext {
  id: string;
  userId: string;
  url: string;
  baseUrl: string;
  path?: string; // Optional as per client-side context.ts logic
  pathArray?: string[]; // Optional
  workspaceId: string; // Crucial for subscriptions
  acl?: Record<string, string>; // Assuming ACL is an object, adjust if needed
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  locked: boolean;
  serverContextArray?: string[];
  clientContextArray?: string[];
  contextArray?: string[]; // This was in client-side context.ts, seems to be contextBitmapArray from server
  contextBitmapArray?: string[]; // From server
  featureBitmapArray?: string[];
  filterArray?: string[];
  pendingUrl?: string | null;
  color?: string; // From client-side context.ts
  tree?: any; // From client-side context.ts, type can be refined if known
  // Flag to track the source of context updates
  serverInitiated?: boolean;
  // Add any other properties that are consistently part of the context object
}
