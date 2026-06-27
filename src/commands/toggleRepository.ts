import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';
import { IssueTreeProvider } from '../views/issueTreeProvider';
import { RepositoryItem } from '../views/items/repositoryItem';

export function registerToggleRepositoryCommand(
  configManager: ConfigManager,
  treeProvider: IssueTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('hubkey.toggleRepository', async (item?: RepositoryItem) => {
    if (!item) {
      const repos = configManager.getAllRepositories();
      const pick = await vscode.window.showQuickPick(
        repos.map((r) => ({
          label: `${r.enabled ? '$(eye)' : '$(eye-closed)'} ${r.projectKey} — ${r.owner}/${r.repo}`,
          config: r,
        })),
        { placeHolder: 'Toggle repository visibility' }
      );
      if (!pick) {
        return;
      }
      await configManager.toggleRepository(pick.config.owner, pick.config.repo);
    } else {
      await configManager.toggleRepository(item.config.owner, item.config.repo);
    }
    treeProvider.refresh();
  });
}
