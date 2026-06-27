export interface RepositoryConfig {
  owner: string;
  repo: string;
  projectKey: string;
  enabled: boolean;
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

  owner: string;
  repo: string;
}

export interface ParsedKey {
  key: string;
  number: number | undefined;
}

export type IssueStateFilter = 'open' | 'closed' | 'all';
