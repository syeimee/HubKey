export interface RepositoryConfig {
  owner: string;
  repo: string;
  projectKey: string;
  enabled: boolean;
  apiUrl?: string;  // e.g. "http://localhost:8080/api/v3" for GitBucket
  token?: string;   // Per-repository token (for GitBucket / GitHub Enterprise)
}

export interface HubKeyConfig {
  repositories: RepositoryConfig[];
}

export interface HubKeyIssue {
  githubNumber: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;

  projectKey: string;
  keyNumber: number;
  fullKey: string;

  commentCount: number;

  owner: string;
  repo: string;
  apiUrl?: string;
  token?: string;
}

export interface ParsedKey {
  key: string;
  number: number | undefined;
}

export type IssueStateFilter = 'open' | 'closed' | 'all';
