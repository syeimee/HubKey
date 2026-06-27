import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { GitHubService } from '../services/githubService';
import { KeyNumberingService } from '../services/keyNumberingService';
import { IssueFormPanel } from '../views/webview/issueFormPanel';
import { IssueTreeProvider } from '../views/issueTreeProvider';
import { IssueItem } from '../views/items/issueItem';

export function registerEditIssueCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  githubService: GitHubService,
  keyService: KeyNumberingService,
  treeProvider: IssueTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('hubkey.editIssue', async (item?: IssueItem) => {
    if (!item) {
      vscode.window.showWarningMessage('HubKey: Select an issue from the tree view.');
      return;
    }

    const issue = item.issue;
    const repoConfig = configManager.getAllRepositories().find(
      (r) => r.owner === issue.owner && r.repo === issue.repo
    );
    if (!repoConfig) {
      return;
    }

    const panel = new IssueFormPanel(githubService);
    await panel.showEditForm(issue, repoConfig, async (data) => {
      try {
        // Preserve the hubkey marker in the body
        const markerMatch = issue.body.match(/<!-- hubkey:[A-Z][A-Z0-9_-]*-\d+ -->/);
        const marker = markerMatch ? markerMatch[0] : '';
        const newBody = marker ? `${data.body}\n\n${marker}` : data.body;

        await githubService.updateIssue(issue.owner, issue.repo, issue.githubNumber, {
          title: data.title,
          body: newBody,
          labels: data.labels,
          assignees: data.assignees,
        }, issue.apiUrl, issue.token);

        if (data.comment) {
          await githubService.addComment(issue.owner, issue.repo, issue.githubNumber, data.comment, issue.apiUrl, issue.token);
        }

        vscode.window.showInformationMessage(`HubKey: Updated ${issue.fullKey}`);
        treeProvider.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`HubKey: Failed to update issue: ${message}`);
      }
    });
  });
}
