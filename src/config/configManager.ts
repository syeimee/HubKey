import * as vscode from 'vscode';
import { HubKeyConfig, RepositoryConfig } from '../models/types';
import { CONFIG_FILE_NAME } from '../utils/constants';

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_-]{0,9}$/;

export class ConfigManager {
  private config: HubKeyConfig | null = null;
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly _onDidChange = new vscode.EventEmitter<HubKeyConfig>();
  readonly onDidChange = this._onDidChange.event;

  async load(): Promise<HubKeyConfig | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }
    // Always set up watcher regardless of whether config exists yet
    this.setupWatcher(workspaceFolder);
    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, CONFIG_FILE_NAME);
    try {
      const data = await vscode.workspace.fs.readFile(configUri);
      const raw = JSON.parse(Buffer.from(data).toString('utf-8'));
      if (!this.validate(raw)) {
        vscode.window.showErrorMessage('HubKey: .hubkey.json is invalid.');
        return null;
      }
      this.config = this.normalize(raw);
      return this.config;
    } catch {
      return null;
    }
  }

  private normalize(raw: HubKeyConfig): HubKeyConfig {
    return {
      repositories: raw.repositories.map((r) => ({
        owner: r.owner,
        repo: r.repo,
        projectKey: r.projectKey.toUpperCase(),
        enabled: r.enabled !== false,
        apiUrl: r.apiUrl,
        token: r.token,
      })),
    };
  }

  private validate(raw: unknown): raw is HubKeyConfig {
    if (!raw || typeof raw !== 'object') {
      return false;
    }
    const obj = raw as Record<string, unknown>;
    if (!Array.isArray(obj.repositories)) {
      return false;
    }
    const keys = new Set<string>();
    const repos = new Set<string>();
    for (const entry of obj.repositories) {
      if (typeof entry !== 'object' || !entry) {
        return false;
      }
      const r = entry as Record<string, unknown>;
      if (typeof r.owner !== 'string' || typeof r.repo !== 'string' || typeof r.projectKey !== 'string') {
        return false;
      }
      if (r.apiUrl !== undefined && typeof r.apiUrl !== 'string') {
        return false;
      }
      if (r.token !== undefined && typeof r.token !== 'string') {
        return false;
      }
      const key = r.projectKey.toUpperCase();
      if (!PROJECT_KEY_PATTERN.test(key)) {
        return false;
      }
      if (keys.has(key)) {
        return false;
      }
      keys.add(key);
      const repoId = `${r.owner}/${r.repo}`;
      if (repos.has(repoId)) {
        return false;
      }
      repos.add(repoId);
    }
    return true;
  }

  private setupWatcher(folder: vscode.WorkspaceFolder): void {
    if (this.watcher) {
      return;
    }
    const pattern = new vscode.RelativePattern(folder, CONFIG_FILE_NAME);
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const reload = async () => {
      await this.load();
      if (this.config) {
        this._onDidChange.fire(this.config);
      }
    };
    this.watcher.onDidChange(reload);
    this.watcher.onDidCreate(reload);
    this.watcher.onDidDelete(() => {
      this.config = null;
    });
  }

  getConfig(): HubKeyConfig | null {
    return this.config;
  }

  getEnabledRepositories(): RepositoryConfig[] {
    return this.config?.repositories.filter((r) => r.enabled) ?? [];
  }

  getAllRepositories(): RepositoryConfig[] {
    return this.config?.repositories ?? [];
  }

  async toggleRepository(owner: string, repo: string): Promise<void> {
    if (!this.config) {
      return;
    }
    const target = this.config.repositories.find((r) => r.owner === owner && r.repo === repo);
    if (!target) {
      return;
    }
    target.enabled = !target.enabled;
    await this.save();
    this._onDidChange.fire(this.config);
  }

  async addRepository(config: Omit<RepositoryConfig, 'enabled'>): Promise<void> {
    if (!this.config) {
      this.config = { repositories: [] };
    }
    this.config.repositories.push({ ...config, enabled: true });
    await this.save();
    this._onDidChange.fire(this.config);
  }

  private async save(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || !this.config) {
      return;
    }
    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, CONFIG_FILE_NAME);
    const data = Buffer.from(JSON.stringify(this.config, null, 2) + '\n', 'utf-8');
    await vscode.workspace.fs.writeFile(configUri, data);
  }

  async initConfig(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('HubKey: No workspace folder open.');
      return;
    }
    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, CONFIG_FILE_NAME);
    try {
      await vscode.workspace.fs.stat(configUri);
      vscode.window.showInformationMessage('HubKey: .hubkey.json already exists.');
      return;
    } catch {
      // file doesn't exist, create it
    }
    const template: HubKeyConfig = {
      repositories: [
        {
          owner: 'your-org',
          repo: 'your-repo',
          projectKey: 'PROJ',
          enabled: true,
        },
      ],
    };
    const data = Buffer.from(JSON.stringify(template, null, 2) + '\n', 'utf-8');
    await vscode.workspace.fs.writeFile(configUri, data);
    await this.load();
    const doc = await vscode.workspace.openTextDocument(configUri);
    await vscode.window.showTextDocument(doc);
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChange.dispose();
  }
}
