import * as vscode from 'vscode';
import { StorageManager } from '../storage/StorageManager';
import { generateInsights } from '../insights/InsightsEngine';
import { buildDashboardHtml } from './dashboardContent';

export class DashboardPanel {
  static readonly viewType = 'keystrand.dashboard';
  private static current: DashboardPanel | undefined;

  private panel: vscode.WebviewPanel;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  static createOrShow(context: vscode.ExtensionContext, storage: StorageManager): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(column);
      DashboardPanel.current.refresh(storage);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'Keystrand Dashboard',
      column,
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.current = new DashboardPanel(panel, context, storage);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private storage: StorageManager
  ) {
    this.panel = panel;
    this.refresh(storage);

    // Auto-refresh every 30s so live session time updates
    this.refreshTimer = setInterval(() => this.refresh(this.storage), 30_000);

    panel.onDidDispose(() => this.dispose(), null, context.subscriptions);

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'requestRefresh') this.refresh(storage);
    });
  }

  refresh(storage: StorageManager): void {
    this.storage = storage;
    const today = storage.getTodayStats();
    const week = storage.getLastNDays(7);
    const month = storage.getLastNDays(30);
    const heatmap = storage.getWeeklyHeatmap();
    const streak = storage.getStreak();
    const longestStreak = storage.getLongestStreak();
    const lifetime = storage.getTotalLifetimeSeconds();
    const insights = generateInsights(today, week, streak);

    this.panel.webview.html = buildDashboardHtml(
      today, week, month, heatmap, streak, longestStreak, lifetime, insights
    );
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.panel.dispose();
  }
}
