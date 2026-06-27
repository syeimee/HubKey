import { GitHubService, GitHubIssueData } from './githubService';
import { HubKeyIssue } from '../models/types';
import { parseMarkerFromBody, buildMarker } from '../utils/keyParser';

export class KeyNumberingService {
  // cache: "owner/repo" -> Map<githubIssueNumber, { key, number }>
  private cache = new Map<string, Map<number, { key: string; number: number }>>();

  constructor(private readonly githubService: GitHubService) {}

  private repoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  async loadKeys(owner: string, repo: string, apiUrl?: string, token?: string): Promise<void> {
    const key = this.repoKey(owner, repo);
    const issues = await this.githubService.listAllIssues(owner, repo, apiUrl, token);
    const map = new Map<number, { key: string; number: number }>();
    for (const issue of issues) {
      if (!issue.body) {
        continue;
      }
      const parsed = parseMarkerFromBody(issue.body);
      if (parsed) {
        map.set(issue.number, parsed);
      }
    }
    this.cache.set(key, map);
  }

  async nextNumber(owner: string, repo: string, projectKey: string, apiUrl?: string, token?: string): Promise<number> {
    const key = this.repoKey(owner, repo);
    if (!this.cache.has(key)) {
      await this.loadKeys(owner, repo, apiUrl, token);
    }
    const map = this.cache.get(key)!;
    let max = 0;
    for (const entry of map.values()) {
      if (entry.key === projectKey && entry.number > max) {
        max = entry.number;
      }
    }
    return max + 1;
  }

  appendMarker(body: string, projectKey: string, number: number): string {
    const marker = buildMarker(projectKey, number);
    return body ? `${body}\n\n${marker}` : marker;
  }

  resolveIssues(
    issues: GitHubIssueData[],
    owner: string,
    repo: string,
    projectKey: string,
    apiUrl?: string,
    token?: string
  ): HubKeyIssue[] {
    const result: HubKeyIssue[] = [];
    for (const issue of issues) {
      const parsed = issue.body ? parseMarkerFromBody(issue.body) : null;
      if (!parsed || parsed.key !== projectKey) {
        continue;
      }
      const labels = issue.labels.map((l) =>
        typeof l === 'string' ? l : l.name ?? ''
      ).filter(Boolean);
      const assignees = issue.assignees?.map((a) => a.login) ?? [];

      // Strip the [KEY-N] prefix from title for clean display
      const cleanTitle = issue.title.replace(/^\[[A-Z][A-Z0-9_-]*-\d+\]\s*/, '');

      result.push({
        githubNumber: issue.number,
        title: cleanTitle,
        body: issue.body ?? '',
        state: issue.state,
        labels,
        assignees,
        htmlUrl: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        projectKey: parsed.key,
        keyNumber: parsed.number,
        fullKey: `${parsed.key}-${parsed.number}`,
        commentCount: issue.comments ?? 0,
        owner,
        repo,
        apiUrl,
        token,
      });
    }
    return result.sort((a, b) => b.keyNumber - a.keyNumber);
  }

  invalidateCache(owner: string, repo: string): void {
    this.cache.delete(this.repoKey(owner, repo));
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
