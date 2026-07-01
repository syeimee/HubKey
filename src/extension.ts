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
import { IssueDetailPanel } from './views/webview/issueDetailPanel';
import { TREE_VIEW_ID } from './utils/constants';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  // Register initConfig regardless of auth status
  context.subscriptions.push(
    vscode.commands.registerCommand('hubkey.initConfig', async () => {
      await configManager.initConfig();
      // Prompt to reload after creating config
      const selection = await vscode.window.showInformationMessage(
        'HubKey: .hubkey.json created. Reload window to activate.',
        'Reload Window'
      );
      if (selection === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    })
  );

  // Check if config exists, show welcome message if not
  if (!config) {
    const selection = await vscode.window.showInformationMessage(
      'HubKey: Welcome! Create .hubkey.json to get started.',
      'Create Config',
      'Later'
    );
    if (selection === 'Create Config') {
      vscode.commands.executeCommand('hubkey.initConfig');
    }
    // Register placeholder commands
    registerPlaceholderCommands(context, 'config');
    return;
  }

  const authService = new AuthService(context.secrets);
  await authService.initialize();

  const token = authService.getToken();

  if (!token) {
    // Show auth setup notification
    const selection = await vscode.window.showWarningMessage(
      'HubKey: GitHub authentication required.',
      'Configure gh Path',
      'Use PAT',
      'Open Settings'
    );
    if (selection === 'Configure gh Path') {
      const ghPath = await vscode.window.showInputBox({
        prompt: 'Enter the full path to gh executable (run "which gh" in terminal to find it)',
        placeHolder: '/usr/local/bin/gh',
        ignoreFocusOut: true,
      });
      if (ghPath) {
        await vscode.workspace.getConfiguration('hubkey.auth').update('ghPath', ghPath, vscode.ConfigurationTarget.Global);
        const reload = await vscode.window.showInformationMessage(
          'HubKey: gh path saved. Reload to apply.',
          'Reload Window'
        );
        if (reload === 'Reload Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      }
    } else if (selection === 'Use PAT') {
      await vscode.workspace.getConfiguration('hubkey.auth').update('method', 'pat', vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('HubKey: Switched to PAT mode. Reload to enter token.');
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else if (selection === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'hubkey.auth');
    }

    registerPlaceholderCommands(context, 'auth');
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

  // Update TreeView badge when change count updates
  const countListener = treeProvider.onDidChangeCount((count) => {
    treeView.badge = count > 0
      ? { value: count, tooltip: `${count} updated issue(s)` }
      : undefined;
  });

  // Register commands
  context.subscriptions.push(
    treeView,
    configManager,
    countListener,
    registerCreateIssueCommand(context, configManager, githubService, keyService, treeProvider),
    registerEditIssueCommand(context, configManager, githubService, keyService, treeProvider),
    registerToggleRepositoryCommand(configManager, treeProvider),
    registerSearchByKeyCommand(treeProvider),
    registerFilterStateCommand(treeProvider),
    vscode.commands.registerCommand('hubkey.refreshTree', async () => {
      treeProvider.refresh();
      await IssueDetailPanel.refreshAllOpenPanels();
    }),
    vscode.commands.registerCommand('hubkey.openOnGitHub', (item?: IssueItem) => {
      if (item) {
        vscode.env.openExternal(vscode.Uri.parse(item.issue.htmlUrl));
      }
    }),
    vscode.commands.registerCommand('hubkey.showIssueDetail', async (item?: IssueItem) => {
      if (!item) { return; }
      treeProvider.markAsRead(item.issue);
      const detailPanel = new IssueDetailPanel(githubService);
      await detailPanel.show(item.issue, async (newState) => {
        await githubService.updateIssue(item.issue.owner, item.issue.repo, item.issue.githubNumber, { state: newState }, item.issue.apiUrl, item.issue.token);
        const action = newState === 'closed' ? 'Closed' : 'Reopened';
        vscode.window.showInformationMessage(`HubKey: ${action} ${item.issue.fullKey}`);
        treeProvider.refresh();
      });
    }),
    vscode.commands.registerCommand('hubkey.closeIssue', async (item?: IssueItem) => {
      if (!item) { return; }
      const issue = item.issue;
      await githubService.updateIssue(issue.owner, issue.repo, issue.githubNumber, { state: 'closed' }, issue.apiUrl, issue.token);
      vscode.window.showInformationMessage(`HubKey: Closed ${issue.fullKey}`);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('hubkey.reopenIssue', async (item?: IssueItem) => {
      if (!item) { return; }
      const issue = item.issue;
      await githubService.updateIssue(issue.owner, issue.repo, issue.githubNumber, { state: 'open' }, issue.apiUrl);
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

function registerPlaceholderCommands(context: vscode.ExtensionContext, reason: 'config' | 'auth'): void {
  const handler = () => {
    if (reason === 'config') {
      vscode.window.showWarningMessage(
        'HubKey: Please create .hubkey.json first.',
        'Create Config'
      ).then(selection => {
        if (selection === 'Create Config') {
          vscode.commands.executeCommand('hubkey.initConfig');
        }
      });
    } else {
      vscode.window.showWarningMessage(
        'HubKey: Authentication required.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'hubkey.auth');
        }
      });
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('hubkey.refreshTree', handler),
    vscode.commands.registerCommand('hubkey.createIssue', handler),
    vscode.commands.registerCommand('hubkey.editIssue', handler),
    vscode.commands.registerCommand('hubkey.closeIssue', handler),
    vscode.commands.registerCommand('hubkey.reopenIssue', handler),
    vscode.commands.registerCommand('hubkey.toggleRepository', handler),
    vscode.commands.registerCommand('hubkey.searchByKey', handler),
    vscode.commands.registerCommand('hubkey.filterState', handler),
    vscode.commands.registerCommand('hubkey.openOnGitHub', handler),
    vscode.commands.registerCommand('hubkey.showIssueDetail', handler),
    vscode.commands.registerCommand('hubkey.addRepository', handler),
  );
}
