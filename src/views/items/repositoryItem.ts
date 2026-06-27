import * as vscode from 'vscode';
import { RepositoryConfig } from '../../models/types';

export class RepositoryItem extends vscode.TreeItem {
  readonly contextValue = 'repository';

  constructor(public readonly config: RepositoryConfig) {
    super(
      `${config.projectKey} — ${config.owner}/${config.repo}`,
      config.enabled
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = new vscode.ThemeIcon(
      config.enabled ? 'repo' : 'repo',
      config.enabled ? undefined : new vscode.ThemeColor('disabledForeground')
    );
    this.description = config.enabled ? '' : '(hidden)';
  }
}
