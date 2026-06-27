import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { GitHubService } from '../services/githubService';
import { KeyNumberingService } from '../services/keyNumberingService';
import { IssueStateFilter, HubKeyIssue } from '../models/types';
import { matchesSearch } from '../utils/keyParser';
import { RepositoryItem } from './items/repositoryItem';
import { IssueItem } from './items/issueItem';

type TreeNode = RepositoryItem | IssueItem;

// Snapshot of an issue for change detection
interface IssueSnapshot {
  commentCount: number;
  updatedAt: string;
  state: string;
}

export class IssueTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private stateFilter: IssueStateFilter = 'open';
  private searchQuery: string | null = null;

  // Change tracking: "owner/repo#number" -> snapshot
  private previousSnapshots = new Map<string, IssueSnapshot>();
  private changedIssueKeys = new Set<string>();

  // Expose for TreeView badge
  private _onDidChangeCount = new vscode.EventEmitter<number>();
  readonly onDidChangeCount = this._onDidChangeCount.event;

  constructor(
    private readonly configManager: ConfigManager,
    private readonly githubService: GitHubService,
    private readonly keyService: KeyNumberingService
  ) {
    const defaultState = vscode.workspace.getConfiguration('hubkey').get<IssueStateFilter>('defaultState', 'open');
    this.stateFilter = defaultState;
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      return this.getRootNodes();
    }
    if (element instanceof RepositoryItem) {
      return this.getIssueNodes(element);
    }
    return [];
  }

  private getRootNodes(): TreeNode[] {
    const repos = this.configManager.getAllRepositories();
    return repos.map((r) => new RepositoryItem(r));
  }

  private async getIssueNodes(repoItem: RepositoryItem): Promise<IssueItem[]> {
    const { owner, repo, projectKey, enabled, apiUrl, token } = repoItem.config;
    if (!enabled) {
      return [];
    }
    try {
      const fetchLimit = vscode.workspace.getConfiguration('hubkey').get<number>('fetchLimit', 100);
      const issues = await this.githubService.listIssues(owner, repo, this.stateFilter, fetchLimit, apiUrl, token);
      const resolved = this.keyService.resolveIssues(issues, owner, repo, projectKey, apiUrl, token);

      // Detect changes
      for (const issue of resolved) {
        const snapshotKey = `${issue.owner}/${issue.repo}#${issue.githubNumber}`;
        const prev = this.previousSnapshots.get(snapshotKey);
        if (prev) {
          const changed =
            prev.commentCount !== issue.commentCount ||
            prev.updatedAt !== issue.updatedAt ||
            prev.state !== issue.state;
          if (changed) {
            this.changedIssueKeys.add(snapshotKey);
          }
        }
        // Update snapshot
        this.previousSnapshots.set(snapshotKey, {
          commentCount: issue.commentCount,
          updatedAt: issue.updatedAt,
          state: issue.state,
        });
      }

      this._onDidChangeCount.fire(this.changedIssueKeys.size);

      let filtered = resolved;
      if (this.searchQuery) {
        filtered = resolved.filter((issue) => matchesSearch(issue, this.searchQuery!));
      }
      return filtered.map((issue) => {
        const snapshotKey = `${issue.owner}/${issue.repo}#${issue.githubNumber}`;
        const hasChanges = this.changedIssueKeys.has(snapshotKey);
        return new IssueItem(issue, hasChanges);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`HubKey: Failed to fetch issues for ${owner}/${repo}: ${message}`);
      return [];
    }
  }

  markAsRead(issue: HubKeyIssue): void {
    const snapshotKey = `${issue.owner}/${issue.repo}#${issue.githubNumber}`;
    this.changedIssueKeys.delete(snapshotKey);
    this._onDidChangeCount.fire(this.changedIssueKeys.size);
    this._onDidChangeTreeData.fire(undefined);
  }

  getChangedCount(): number {
    return this.changedIssueKeys.size;
  }

  refresh(): void {
    this.keyService.invalidateAll();
    this._onDidChangeTreeData.fire(undefined);
  }

  setFilter(state: IssueStateFilter): void {
    this.stateFilter = state;
    this._onDidChangeTreeData.fire(undefined);
  }

  getFilter(): IssueStateFilter {
    return this.stateFilter;
  }

  setSearch(query: string | null): void {
    this.searchQuery = query;
    this._onDidChangeTreeData.fire(undefined);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this._onDidChangeCount.dispose();
  }
}
