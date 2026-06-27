import * as vscode from 'vscode';
import { HubKeyIssue } from '../../models/types';

export class IssueItem extends vscode.TreeItem {
  constructor(
    public readonly issue: HubKeyIssue,
    public readonly hasChanges: boolean = false
  ) {
    super(
      `${hasChanges ? '● ' : ''}${issue.fullKey}: ${issue.title}`,
      vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = issue.state === 'open' ? 'issueOpen' : 'issueClosed';

    const parts: string[] = [`#${issue.githubNumber}`];
    if (issue.assignees.length > 0) {
      parts.push(`@${issue.assignees[0]}`);
    }
    if (issue.commentCount > 0) {
      parts.push(`💬${issue.commentCount}`);
    }
    if (hasChanges) {
      parts.push('updated');
    }
    this.description = parts.join(' · ');

    this.iconPath = new vscode.ThemeIcon(
      issue.state === 'open' ? 'issues' : 'issue-closed',
      hasChanges
        ? new vscode.ThemeColor('charts.yellow')
        : issue.state === 'open'
          ? new vscode.ThemeColor('charts.green')
          : new vscode.ThemeColor('charts.purple')
    );

    this.command = {
      command: 'hubkey.showIssueDetail',
      title: 'Show Issue Detail',
      arguments: [this],
    };

    this.tooltip = new vscode.MarkdownString(
      `${hasChanges ? '**● Updated**\n\n' : ''}` +
      `**${issue.fullKey}: ${issue.title}**\n\n` +
      `State: ${issue.state}\n\n` +
      (issue.labels.length > 0 ? `Labels: ${issue.labels.join(', ')}\n\n` : '') +
      (issue.assignees.length > 0 ? `Assignees: ${issue.assignees.map(a => `@${a}`).join(', ')}\n\n` : '') +
      `Comments: ${issue.commentCount}\n\n` +
      `GitHub: #${issue.githubNumber}`
    );
  }
}
