import * as vscode from 'vscode';
import { ConfigManager } from './config/configManager';
import { AuthService } from './services/authService';
import { GitHubService } from './services/githubService';
import { KeyNumberingService } from './services/keyNumberingService';
import { IssueTreeProvider } from './views/issueTreeProvider';
import { IssueItem } from './views/items/issueItem';
import { registerCreateIssueCommand } from './commands/createIssue';
import { registerEditIssueCommand } from './commands/editIssue';
import { registerToggleRepositoryCommand } from './commands/toggleRepository';
import { registerSearchByKeyCommand } from './commands/searchByKey';
import { registerFilterStateCommand } from './commands/filterState';
import { TREE_VIEW_ID } from './utils/constants';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const authService = new AuthService(context.secrets);
  await authService.initialize();

  const token = authService.getToken();
  if (!token) {
    // Register init command even without auth
    context.subscriptions.push(
      vscode.commands.registerCommand('hubkey.initConfig', () => configManager.initConfig())
    );
    return;
  }

  const githubService = new GitHubService(token);
  const keyService = new KeyNumberingService(githubService);
  const treeProvider = new IssueTreeProvider(configManager, githubService, keyService);

  const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Reload tree when config changes
  configManager.onDidChange(() => treeProvider.refresh());

  // Register commands
  context.subscriptions.push(
    treeView,
    configManager,
    registerCreateIssueCommand(context, configManager, githubService, keyService, treeProvider),
    registerEditIssueCommand(context, configManager, githubService, keyService, treeProvider),
    registerToggleRepositoryCommand(configManager, treeProvider),
    registerSearchByKeyCommand(treeProvider),
    registerFilterStateCommand(treeProvider),
    vscode.commands.registerCommand('hubkey.refreshTree', () => treeProvider.refresh()),
    vscode.commands.registerCommand('hubkey.initConfig', () => configManager.initConfig()),
    vscode.commands.registerCommand('hubkey.openOnGitHub', (item?: IssueItem) => {
      if (item) {
        vscode.env.openExternal(vscode.Uri.parse(item.issue.htmlUrl));
      }
    }),
    vscode.commands.registerCommand('hubkey.closeIssue', async (item?: IssueItem) => {
      if (!item) { return; }
      const issue = item.issue;
      await githubService.updateIssue(issue.owner, issue.repo, issue.githubNumber, { state: 'closed' });
      vscode.window.showInformationMessage(`HubKey: Closed ${issue.fullKey}`);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('hubkey.reopenIssue', async (item?: IssueItem) => {
      if (!item) { return; }
      const issue = item.issue;
      await githubService.updateIssue(issue.owner, issue.repo, issue.githubNumber, { state: 'open' });
      vscode.window.showInformationMessage(`HubKey: Reopened ${issue.fullKey}`);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('hubkey.addRepository', async () => {
      const owner = await vscode.window.showInputBox({ prompt: 'Repository owner (e.g. myorg)' });
      if (!owner) { return; }
      const repo = await vscode.window.showInputBox({ prompt: 'Repository name (e.g. my-repo)' });
      if (!repo) { return; }
      const projectKey = await vscode.window.showInputBox({
        prompt: 'Project key (e.g. PROJ)',
        validateInput: (v) => /^[A-Z][A-Z0-9_-]{0,9}$/.test(v.toUpperCase()) ? null : 'Must be 1-10 uppercase alphanumeric characters',
      });
      if (!projectKey) { return; }
      await configManager.addRepository({ owner, repo, projectKey: projectKey.toUpperCase() });
      treeProvider.refresh();
    }),
  );

  if (config) {
    treeProvider.refresh();
  }
}

export function deactivate(): void {}
