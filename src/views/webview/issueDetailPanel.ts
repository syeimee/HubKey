import * as vscode from 'vscode';
import { GitHubService } from '../../services/githubService';
import { HubKeyIssue } from '../../models/types';
import { getNonce } from '../../utils/nonce';

export interface GitHubComment {
  user: { login: string } | null;
  body: string;
  created_at: string;
}

export class IssueDetailPanel {
  private static panels = new Map<string, vscode.WebviewPanel>();
  private static instances = new Map<string, IssueDetailPanel>();
  private static issueData = new Map<string, HubKeyIssue>();

  constructor(
    private readonly githubService: GitHubService
  ) {}

  static async refreshAllOpenPanels(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const [panelKey, instance] of IssueDetailPanel.instances) {
      const panel = IssueDetailPanel.panels.get(panelKey);
      const issue = IssueDetailPanel.issueData.get(panelKey);
      if (panel && issue) {
        tasks.push(instance.updatePanelContent(panel, issue));
      }
    }
    await Promise.all(tasks);
  }

  async show(
    issue: HubKeyIssue,
    onStateChange: (newState: 'open' | 'closed') => Promise<void>
  ): Promise<void> {
    const panelKey = `${issue.owner}/${issue.repo}#${issue.githubNumber}`;

    // If panel already open, refresh its content and reveal
    const existing = IssueDetailPanel.panels.get(panelKey);
    if (existing) {
      existing.reveal();
      await this.updatePanelContent(existing, issue);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'hubkey.issueDetail',
      `${issue.fullKey}: ${issue.title}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    IssueDetailPanel.panels.set(panelKey, panel);
    IssueDetailPanel.instances.set(panelKey, this);
    IssueDetailPanel.issueData.set(panelKey, issue);
    panel.onDidDispose(() => {
      IssueDetailPanel.panels.delete(panelKey);
      IssueDetailPanel.instances.delete(panelKey);
      IssueDetailPanel.issueData.delete(panelKey);
    });

    let currentIssue = { ...issue };

    // Initial render with loading state, then fetch comments
    panel.webview.html = this.getHtml(currentIssue, [], true);
    await this.updatePanelContent(panel, currentIssue);

    panel.webview.onDidReceiveMessage(async (msg: { command: string; body?: string }) => {
      try {
        if (msg.command === 'close' || msg.command === 'reopen') {
          const newState = msg.command === 'close' ? 'closed' : 'open';
          await onStateChange(newState);
          currentIssue = { ...currentIssue, state: newState };
          IssueDetailPanel.issueData.set(panelKey, currentIssue);
          await this.updatePanelContent(panel, currentIssue);
        } else if (msg.command === 'openOnGitHub') {
          vscode.env.openExternal(vscode.Uri.parse(currentIssue.htmlUrl));
        } else if (msg.command === 'addComment' && msg.body) {
          await this.githubService.addComment(
            currentIssue.owner, currentIssue.repo, currentIssue.githubNumber, msg.body, currentIssue.apiUrl, currentIssue.token
          );
          vscode.window.showInformationMessage(`HubKey: Comment added to ${currentIssue.fullKey}`);
          await this.updatePanelContent(panel, currentIssue);
        } else if (msg.command === 'refresh') {
          await this.updatePanelContent(panel, currentIssue);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`HubKey: ${message}`);
      }
    });
  }

  private async updatePanelContent(panel: vscode.WebviewPanel, issue: HubKeyIssue): Promise<void> {
    let comments: GitHubComment[] = [];
    let fetchError: string | null = null;
    try {
      comments = await this.githubService.listComments(issue.owner, issue.repo, issue.githubNumber, issue.apiUrl, issue.token);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Unknown error';
    }
    panel.webview.html = this.getHtml(issue, comments, false, fetchError);
  }

  private getHtml(
    issue: HubKeyIssue,
    comments: GitHubComment[],
    loading: boolean,
    fetchError?: string | null
  ): string {
    const body = (issue.body ?? '')
      .replace(/\n?\n?<!-- hubkey:[A-Z][A-Z0-9_-]*-\d+ -->/, '')
      .trim();

    const stateIcon = issue.state === 'open' ? '🟢' : '🟣';
    const stateLabel = issue.state === 'open' ? 'Open' : 'Closed';
    const toggleBtnLabel = issue.state === 'open' ? 'Close Issue' : 'Reopen Issue';
    const toggleBtnCommand = issue.state === 'open' ? 'close' : 'reopen';
    const toggleBtnClass = issue.state === 'open' ? 'btn-danger' : 'btn-success';

    const commentsHtml = comments.map((c) => `
      <div class="comment">
        <div class="comment-header">
          <strong>@${this.esc(c.user?.login ?? 'unknown')}</strong>
          <span class="comment-date">${this.formatDate(c.created_at)}</span>
        </div>
        <div class="comment-body">${this.renderMarkdown(c.body ?? '')}</div>
      </div>
    `).join('');

    let commentsContent: string;
    if (loading) {
      commentsContent = '<p class="no-comments">Loading comments...</p>';
    } else if (fetchError) {
      commentsContent = `<p class="error-msg">Failed to fetch comments: ${this.esc(fetchError)}</p>`;
    } else if (comments.length > 0) {
      commentsContent = commentsHtml;
    } else {
      commentsContent = '<p class="no-comments">No comments yet.</p>';
    }

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.esc(issue.fullKey)}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 20px;
    max-width: 800px;
    line-height: 1.6;
  }
  .header { margin-bottom: 16px; }
  .header h1 { margin: 0 0 8px 0; font-size: 1.4em; }
  .meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .badge-state {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .badge-label {
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-textBlockQuote-border);
  }
  .badge-repo {
    background: var(--vscode-textPreformat-background);
    color: var(--vscode-textPreformat-foreground);
  }
  .body-section {
    padding: 16px;
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-textBlockQuote-border);
    border-radius: 6px;
    margin-bottom: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .body-section:empty::after {
    content: "No description provided.";
    color: var(--vscode-descriptionForeground);
    font-style: italic;
  }
  .actions { display: flex; gap: 8px; margin-bottom: 24px; }
  button {
    padding: 6px 16px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
  }
  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .btn-danger {
    background: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-inputValidation-errorForeground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
  }
  .btn-success {
    background: var(--vscode-inputValidation-infoBackground);
    color: var(--vscode-inputValidation-infoForeground);
    border: 1px solid var(--vscode-inputValidation-infoBorder);
  }
  .comments-section h2 { font-size: 1.1em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .comment {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .comment-header {
    padding: 8px 12px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9em;
  }
  .comment-date { color: var(--vscode-descriptionForeground); }
  .comment-body {
    padding: 12px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .no-comments {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
  }
  .error-msg {
    color: var(--vscode-errorForeground);
    font-style: italic;
  }
  .info-row { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-bottom: 4px; }
  .add-comment { margin-top: 20px; }
  .add-comment h2 { font-size: 1.1em; margin-bottom: 8px; }
  .add-comment textarea {
    width: 100%;
    min-height: 80px;
    padding: 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-family: inherit;
    font-size: inherit;
    resize: vertical;
    box-sizing: border-box;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${this.esc(issue.fullKey)}: ${this.esc(issue.title)}</h1>
    <div class="meta">
      <span class="badge badge-state">${stateIcon} ${stateLabel}</span>
      <span class="badge badge-repo">${this.esc(issue.owner)}/${this.esc(issue.repo)}</span>
      ${issue.labels.map((l) => `<span class="badge badge-label">${this.esc(l)}</span>`).join('')}
    </div>
    ${issue.assignees.length > 0 ? `<div class="info-row">Assignees: ${issue.assignees.map((a) => '@' + this.esc(a)).join(', ')}</div>` : ''}
    <div class="info-row">GitHub #${issue.githubNumber} · Created ${this.formatDate(issue.createdAt)} · Updated ${this.formatDate(issue.updatedAt)}</div>
  </div>

  <div class="actions">
    <button class="${toggleBtnClass}" data-command="${toggleBtnCommand}">${toggleBtnLabel}</button>
    <button class="btn-primary" data-command="openOnGitHub">Open on GitHub</button>
    <button class="btn-secondary" data-command="refresh">Refresh</button>
  </div>

  <div class="body-section">${this.renderMarkdown(body)}</div>

  <div class="comments-section">
    <h2>Comments${loading ? '' : ` (${comments.length})`}</h2>
    ${commentsContent}
  </div>

  <div class="add-comment">
    <h2>Add Comment</h2>
    <textarea id="newComment" placeholder="Write a comment..."></textarea>
    <button class="btn-primary" id="addCommentBtn" style="margin-top: 8px;">Comment</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-command]').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: btn.getAttribute('data-command') });
      });
    });
    document.getElementById('addCommentBtn').addEventListener('click', () => {
      const body = document.getElementById('newComment').value.trim();
      if (!body) { return; }
      vscode.postMessage({ command: 'addComment', body });
    });
  </script>
</body>
</html>`;
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private renderMarkdown(text: string): string {
    return this.esc(text)
      .replace(/\n/g, '<br>');
  }

  private esc(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
