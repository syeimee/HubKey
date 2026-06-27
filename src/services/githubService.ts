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
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async listIssues(
    owner: string,
    repo: string,
    state: IssueStateFilter,
    perPage: number = 100
  ): Promise<GitHubIssueData[]> {
    const response = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: state === 'all' ? 'all' : state,
      per_page: perPage,
      sort: 'created',
      direction: 'desc',
    });
    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    return response.data.filter((issue) => !issue.pull_request) as GitHubIssueData[];
  }

  async listAllIssues(
    owner: string,
    repo: string
  ): Promise<GitHubIssueData[]> {
    const issues: GitHubIssueData[] = [];
    let page = 1;
    while (true) {
      const response = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        page,
        sort: 'created',
        direction: 'desc',
      });
      const filtered = response.data.filter((issue) => !issue.pull_request) as GitHubIssueData[];
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
    assignees?: string[]
  ): Promise<GitHubIssueData> {
    const response = await this.octokit.issues.create({
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
    }
  ): Promise<GitHubIssueData> {
    const response = await this.octokit.issues.update({
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
    body: string
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  async listLabels(owner: string, repo: string): Promise<GitHubLabel[]> {
    const response = await this.octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    return response.data as GitHubLabel[];
  }

  async listAssignees(owner: string, repo: string): Promise<GitHubUser[]> {
    const response = await this.octokit.issues.listAssignees({
      owner,
      repo,
      per_page: 100,
    });
    return response.data as GitHubUser[];
  }
}
