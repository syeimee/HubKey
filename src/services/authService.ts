import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class AuthService {
  private token: string | null = null;

  constructor(private readonly secretStorage: vscode.SecretStorage) {}

  async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('hubkey.auth');
    const method = config.get<string>('method', 'ghCli');

    if (method === 'pat') {
      this.token = await this.secretStorage.get('hubkey.pat') ?? null;
      if (!this.token) {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter your GitHub Personal Access Token',
          password: true,
          ignoreFocusOut: true,
        });
        if (input) {
          await this.secretStorage.store('hubkey.pat', input);
          this.token = input;
        }
      }
    } else {
      this.token = await this.getTokenFromGhCli();
    }

    if (!this.token) {
      vscode.window.showErrorMessage(
        'HubKey: GitHub authentication failed. Check your settings.'
      );
    }
  }

  private async getTokenFromGhCli(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('gh', ['auth', 'token']);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return this.token;
  }
}
