import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { GitHubService } from '../services/githubService';
import { KeyNumberingService } from '../services/keyNumberingService';
import { IssueFormPanel } from '../views/webview/issueFormPanel';
import { IssueTreeProvider } from '../views/issueTreeProvider';

export function registerCreateIssueCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  githubService: GitHubService,
  keyService: KeyNumberingService,
  treeProvider: IssueTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('hubkey.createIssue', async () => {
    const repos = configManager.getEnabledRepositories();
    if (repos.length === 0) {
      vscode.window.showWarningMessage('HubKey: No enabled repositories. Check .hubkey.json.');
      return;
    }

    let selectedRepo = repos[0];
    if (repos.length > 1) {
      const pick = await vscode.window.showQuickPick(
        repos.map((r) => ({
          label: `${r.projectKey} — ${r.owner}/${r.repo}`,
          config: r,
        })),
        { placeHolder: 'Select target repository' }
      );
      if (!pick) {
        return;
      }
      selectedRepo = pick.config;
    }

    const panel = new IssueFormPanel(githubService);
    await panel.showCreateForm(selectedRepo, async (data) => {
      try {
        const nextNum = await keyService.nextNumber(
          selectedRepo.owner,
          selectedRepo.repo,
          selectedRepo.projectKey,
          selectedRepo.apiUrl,
          selectedRepo.token
        );
        const bodyWithMarker = keyService.appendMarker(
          data.body,
          selectedRepo.projectKey,
          nextNum
        );
        const fullKey = `${selectedRepo.projectKey}-${nextNum}`;
        const titledWithKey = `[${fullKey}] ${data.title}`;
        await githubService.createIssue(
          selectedRepo.owner,
          selectedRepo.repo,
          titledWithKey,
          bodyWithMarker,
          data.labels.length > 0 ? data.labels : undefined,
          data.assignees.length > 0 ? data.assignees : undefined,
          selectedRepo.apiUrl,
          selectedRepo.token
        );
        vscode.window.showInformationMessage(`HubKey: Created ${fullKey}: ${data.title}`);
        keyService.invalidateCache(selectedRepo.owner, selectedRepo.repo);
        treeProvider.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`HubKey: Failed to create issue: ${message}`);
      }
    });
  });
}
