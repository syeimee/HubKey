import * as vscode from 'vscode';
import { IssueTreeProvider } from '../views/issueTreeProvider';

export function registerSearchByKeyCommand(
  treeProvider: IssueTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('hubkey.searchByKey', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Search by project key (e.g. FRONT-3, FRONT, or keyword)',
      placeHolder: 'PROJ-1',
    });
    if (query === undefined) {
      return; // cancelled
    }
    treeProvider.setSearch(query || null);
  });
}
