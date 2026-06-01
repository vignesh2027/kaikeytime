import * as vscode from 'vscode';
import { StorageManager } from '../storage/StorageManager';

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export class PulseStatusBar {
  private item: vscode.StatusBarItem;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private sessionExtraSeconds = 0;

  constructor(private storage: StorageManager) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'kaikeytime.openDashboard';
    this.item.name = 'KaikeyTime Pulse';
  }

  show(): void {
    this.item.show();
    this.refresh();
    // Refresh every 10 seconds; fast enough to feel alive without any perf cost
    this.ticker = setInterval(() => this.refresh(), 10_000);
  }

  /** Called each second a session is active so display stays snappy */
  onSessionTick(extraSeconds: number): void {
    this.sessionExtraSeconds = extraSeconds;
    this.refresh();
  }

  onSessionEnd(): void {
    this.sessionExtraSeconds = 0;
    this.refresh();
  }

  private refresh(): void {
    const today = this.storage.getTodayStats();
    const activeSeconds = today.activeSeconds + this.sessionExtraSeconds;
    const streak = this.storage.getStreak();
    const time = fmtTime(activeSeconds);

    const streakText = streak > 0 ? ` · 🔥${streak}d` : '';
    this.item.text = `$(clock) ${time}${streakText}`;
    this.item.tooltip = new vscode.MarkdownString(
      `**KaikeyTime Pulse** — Click to open dashboard\n\n` +
      `Today: **${time}** active  \n` +
      `Streak: **${streak} day${streak !== 1 ? 's' : ''}**  \n` +
      `Lines added: **${today.linesAdded.toLocaleString()}**  \n` +
      `Files touched: **${today.filesEdited.length}**  \n\n` +
      `_All data stored locally — never sent anywhere._`
    );
    this.item.tooltip.isTrusted = true;
  }

  updateVisibility(show: boolean): void {
    show ? this.item.show() : this.item.hide();
  }

  dispose(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.item.dispose();
  }
}
