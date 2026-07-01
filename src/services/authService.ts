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
    const config = vscode.workspace.getConfiguration('hubkey.auth');
    let ghPath = config.get<string>('ghPath', '');

    // 1. Try configured path or default 'gh'
    const pathsToTry = ghPath ? [ghPath] : ['gh'];
    for (const path of pathsToTry) {
      try {
        const { stdout } = await execFileAsync(path, ['auth', 'token']);
        const token = stdout.trim();
        if (token) {
          return token;
        }
      } catch {
        // Continue to next option
      }
    }

    // 2. If no configured path and default failed, prompt user
    if (!ghPath) {
      ghPath = await vscode.window.showInputBox({
        prompt: 'gh CLI not found. Enter the full path to gh executable',
        placeHolder: '/usr/local/bin/gh',
        ignoreFocusOut: true,
      }) ?? '';

      if (ghPath) {
        // Save to settings and try again
        await config.update('ghPath', ghPath, vscode.ConfigurationTarget.Global);
        try {
          const { stdout } = await execFileAsync(ghPath, ['auth', 'token']);
          return stdout.trim() || null;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  getToken(): string | null {
    return this.token;
  }
}
