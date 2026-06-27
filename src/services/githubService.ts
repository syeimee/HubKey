import { Octokit } from '@octokit/rest';
import { IssueStateFilter } from '../models/types';

export interface GitHubIssueData {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<string | { name?: string }>;
  assignees: Array<{ login: string }> | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description: string | null;
}

export interface GitHubUser {
  login: string;
}

export class GitHubService {
  private readonly defaultOctokit: Octokit;
  private readonly octokitCache = new Map<string, Octokit>();

  constructor(private readonly token: string) {
    this.defaultOctokit = new Octokit({ auth: token });
  }

  getOctokit(apiUrl?: string, token?: string): Octokit {
    const effectiveToken = token ?? this.token;
    if (!apiUrl && effectiveToken === this.token) {
      return this.defaultOctokit;
    }
    const cacheKey = `${apiUrl ?? 'default'}::${effectiveToken}`;
    let octokit = this.octokitCache.get(cacheKey);
    if (!octokit) {
      const opts: { auth: string; baseUrl?: string } = { auth: effectiveToken };
      if (apiUrl) {
        opts.baseUrl = apiUrl;
      }
      octokit = new Octokit(opts);
      this.octokitCache.set(cacheKey, octokit);
    }
    return octokit;
  }

  async listIssues(
    owner: string,
    repo: string,
    state: IssueStateFilter,
    perPage: number = 100,
    apiUrl?: string,
    token?: string
  ): Promise<GitHubIssueData[]> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.listForRepo({
      owner,
      repo,
      state: state === 'all' ? 'all' : state,
      per_page: perPage,
      sort: 'created',
      direction: 'desc',
    });
    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    return response.data.filter((issue: Record<string, unknown>) => !issue.pull_request) as GitHubIssueData[];
  }

  async listAllIssues(
    owner: string,
    repo: string,
    apiUrl?: string,
    token?: string
  ): Promise<GitHubIssueData[]> {
    const octokit = this.getOctokit(apiUrl, token);
    const issues: GitHubIssueData[] = [];
    let page = 1;
    const maxPages = 50; // Safety limit: 5000 issues max
    while (page <= maxPages) {
      const response = await octokit.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        page,
        sort: 'created',
        direction: 'desc',
      });
      const filtered = response.data.filter((issue: Record<string, unknown>) => !issue.pull_request) as GitHubIssueData[];
      issues.push(...filtered);
      if (response.data.length < 100) {
        break;
      }
      page++;
    }
    return issues;
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
    assignees?: string[],
    apiUrl?: string,
    token?: string
  ): Promise<GitHubIssueData> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
      assignees,
    });
    return response.data as GitHubIssueData;
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    patch: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
    },
    apiUrl?: string,
    token?: string
  ): Promise<GitHubIssueData> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...patch,
    });
    return response.data as GitHubIssueData;
  }

  async addComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
    apiUrl?: string,
    token?: string
  ): Promise<void> {
    const octokit = this.getOctokit(apiUrl, token);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  async listComments(
    owner: string,
    repo: string,
    issueNumber: number,
    apiUrl?: string,
    token?: string
  ): Promise<Array<{ user: { login: string } | null; body: string; created_at: string }>> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });
    return response.data as Array<{ user: { login: string } | null; body: string; created_at: string }>;
  }

  async listLabels(owner: string, repo: string, apiUrl?: string, token?: string): Promise<GitHubLabel[]> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    return response.data as GitHubLabel[];
  }

  async listAssignees(owner: string, repo: string, apiUrl?: string, token?: string): Promise<GitHubUser[]> {
    const octokit = this.getOctokit(apiUrl, token);
    const response = await octokit.issues.listAssignees({
      owner,
      repo,
      per_page: 100,
    });
    return response.data as GitHubUser[];
  }
}
