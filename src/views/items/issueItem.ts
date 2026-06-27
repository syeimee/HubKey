import * as vscode from 'vscode';
import { HubKeyIssue } from '../../models/types';

export class IssueItem extends vscode.TreeItem {
  readonly contextValue = 'issue';

  constructor(public readonly issue: HubKeyIssue) {
    super(`${issue.fullKey}: ${issue.title}`, vscode.TreeItemCollapsibleState.None);

    this.description = `#${issue.githubNumber}`;
    if (issue.assignees.length > 0) {
      this.description += ` · @${issue.assignees[0]}`;
    }

    this.iconPath = new vscode.ThemeIcon(
      issue.state === 'open' ? 'issues' : 'issue-closed',
      issue.state === 'open'
        ? new vscode.ThemeColor('charts.green')
        : new vscode.ThemeColor('charts.purple')
    );

    this.tooltip = new vscode.MarkdownString(
      `**${issue.fullKey}: ${issue.title}**\n\n` +
      `State: ${issue.state}\n\n` +
      (issue.labels.length > 0 ? `Labels: ${issue.labels.join(', ')}\n\n` : '') +
      (issue.assignees.length > 0 ? `Assignees: ${issue.assignees.map(a => `@${a}`).join(', ')}\n\n` : '') +
      `GitHub: #${issue.githubNumber}`
    );
  }
}
