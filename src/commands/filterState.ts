import * as vscode from 'vscode';
import { IssueTreeProvider } from '../views/issueTreeProvider';
import { IssueStateFilter } from '../models/types';

export function registerFilterStateCommand(
  treeProvider: IssueTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('hubkey.filterState', async () => {
    const current = treeProvider.getFilter();
    const items: Array<{ label: string; value: IssueStateFilter }> = [
      { label: `$(issue-opened) Open${current === 'open' ? ' (current)' : ''}`, value: 'open' },
      { label: `$(issue-closed) Closed${current === 'closed' ? ' (current)' : ''}`, value: 'closed' },
      { label: `$(list-unordered) All${current === 'all' ? ' (current)' : ''}`, value: 'all' },
    ];
    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: 'Filter issues by state',
    });
    if (pick) {
      treeProvider.setFilter(pick.value);
    }
  });
}
