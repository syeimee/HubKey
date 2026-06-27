import * as vscode from 'vscode';
import { GitHubService } from '../../services/githubService';
import { HubKeyIssue, RepositoryConfig } from '../../models/types';
import { getNonce } from '../../utils/nonce';

type FormMode = 'create' | 'edit';

interface CreatePayload {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

interface EditPayload extends CreatePayload {
  comment: string;
}

export class IssueFormPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly githubService: GitHubService
  ) {}

  async showCreateForm(
    repoConfig: RepositoryConfig,
    onCreate: (data: CreatePayload) => Promise<void>
  ): Promise<void> {
    const [labels, assignees] = await Promise.all([
      this.githubService.listLabels(repoConfig.owner, repoConfig.repo, repoConfig.apiUrl, repoConfig.token),
      this.githubService.listAssignees(repoConfig.owner, repoConfig.repo, repoConfig.apiUrl, repoConfig.token),
    ]);

    this.panel = vscode.window.createWebviewPanel(
      'hubkey.issueForm',
      `New Issue — ${repoConfig.projectKey}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.webview.html = this.getHtml(
      'create',
      repoConfig,
      labels.map((l) => l.name),
      assignees.map((a) => a.login),
      undefined
    );

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'submit') {
        await onCreate(msg.data);
        this.panel?.dispose();
      }
    });
  }

  async showEditForm(
    issue: HubKeyIssue,
    repoConfig: RepositoryConfig,
    onEdit: (data: EditPayload) => Promise<void>
  ): Promise<void> {
    const [labels, assignees] = await Promise.all([
      this.githubService.listLabels(repoConfig.owner, repoConfig.repo, repoConfig.apiUrl, repoConfig.token),
      this.githubService.listAssignees(repoConfig.owner, repoConfig.repo, repoConfig.apiUrl, repoConfig.token),
    ]);

    this.panel = vscode.window.createWebviewPanel(
      'hubkey.issueForm',
      `Edit ${issue.fullKey}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.webview.html = this.getHtml(
      'edit',
      repoConfig,
      labels.map((l) => l.name),
      assignees.map((a) => a.login),
      issue
    );

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'submit') {
        await onEdit(msg.data);
        this.panel?.dispose();
      }
    });
  }

  private getHtml(
    mode: FormMode,
    repoConfig: RepositoryConfig,
    labels: string[],
    assignees: string[],
    issue: HubKeyIssue | undefined
  ): string {
    const title = issue?.title ?? '';
    // Strip the hubkey marker from the body for display
    const body = (issue?.body ?? '').replace(/\n?\n?<!-- hubkey:[A-Z][A-Z0-9_-]*-\d+ -->/, '').trim();
    const selectedLabels = issue?.labels ?? [];
    const selectedAssignees = issue?.assignees ?? [];

    const labelCheckboxes = labels
      .map(
        (l) =>
          `<label><input type="checkbox" name="labels" value="${this.escapeHtml(l)}" ${selectedLabels.includes(l) ? 'checked' : ''}> ${this.escapeHtml(l)}</label>`
      )
      .join('\n');

    const assigneeCheckboxes = assignees
      .map(
        (a) =>
          `<label><input type="checkbox" name="assignees" value="${this.escapeHtml(a)}" ${selectedAssignees.includes(a) ? 'checked' : ''}> @${this.escapeHtml(a)}</label>`
      )
      .join('\n');

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mode === 'create' ? 'New Issue' : 'Edit Issue'}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 20px;
    max-width: 700px;
  }
  h2 { margin-top: 0; }
  .field { margin-bottom: 16px; }
  .field label.main { display: block; font-weight: bold; margin-bottom: 4px; }
  input[type="text"], textarea {
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-family: inherit;
    font-size: inherit;
    box-sizing: border-box;
  }
  textarea { min-height: 150px; resize: vertical; }
  .checkbox-group {
    display: flex; flex-wrap: wrap; gap: 8px 16px;
    max-height: 120px; overflow-y: auto;
    padding: 4px;
  }
  .checkbox-group label { white-space: nowrap; }
  button {
    padding: 8px 20px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .repo-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 3px;
    margin-bottom: 12px;
  }
</style>
</head>
<body>
  <h2>${mode === 'create' ? 'Create Issue' : `Edit ${this.escapeHtml(issue?.fullKey ?? '')}`}</h2>
  <div class="repo-badge">${this.escapeHtml(repoConfig.projectKey)} — ${this.escapeHtml(repoConfig.owner)}/${this.escapeHtml(repoConfig.repo)}</div>

  <div class="field">
    <label class="main">Title</label>
    <input type="text" id="title" value="${this.escapeHtml(title)}" placeholder="Issue title" />
  </div>

  <div class="field">
    <label class="main">Body (Markdown)</label>
    <textarea id="body" placeholder="Describe the issue...">${this.escapeHtml(body)}</textarea>
  </div>

  ${labels.length > 0 ? `
  <div class="field">
    <label class="main">Labels</label>
    <div class="checkbox-group">${labelCheckboxes}</div>
  </div>` : ''}

  ${assignees.length > 0 ? `
  <div class="field">
    <label class="main">Assignees</label>
    <div class="checkbox-group">${assigneeCheckboxes}</div>
  </div>` : ''}

  ${mode === 'edit' ? `
  <div class="field">
    <label class="main">Comment (optional)</label>
    <textarea id="comment" placeholder="Add a comment..." style="min-height: 80px;"></textarea>
  </div>` : ''}

  <button id="submitBtn">${mode === 'create' ? 'Create Issue' : 'Update Issue'}</button>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('submitBtn').addEventListener('click', () => {
      const title = document.getElementById('title').value.trim();
      if (!title) { return; }
      const body = document.getElementById('body').value;
      const labels = Array.from(document.querySelectorAll('input[name="labels"]:checked')).map(el => el.value);
      const assignees = Array.from(document.querySelectorAll('input[name="assignees"]:checked')).map(el => el.value);
      const data = { title, body, labels, assignees };
      ${mode === 'edit' ? `data.comment = document.getElementById('comment').value.trim();` : ''}
      vscode.postMessage({ command: 'submit', data });
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
