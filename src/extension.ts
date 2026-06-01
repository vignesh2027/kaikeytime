import * as vscode from 'vscode';
import { ActivityTracker } from './tracker/ActivityTracker';
import { StorageManager } from './storage/StorageManager';
import { PulseStatusBar } from './statusbar/PulseStatusBar';
import { DashboardPanel } from './dashboard/DashboardPanel';
import { StrandGenerator } from './strand/StrandGenerator';

let sessionTickInterval: ReturnType<typeof setInterval> | undefined;
let sessionStartTime = 0;

export async function activate(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration('keystrand');

  // ── Storage ──────────────────────────────────────────────────────────
  const storage = new StorageManager(context.globalStorageUri);
  await storage.load();

  // ── Tracker ──────────────────────────────────────────────────────────
  const idleMs = (cfg.get<number>('idleThresholdSeconds') ?? 120) * 1000;
  const aiThreshold = cfg.get<number>('aiDetectionThreshold') ?? 5;
  const tracker = new ActivityTracker(idleMs, aiThreshold);
  tracker.start();

  // ── Status Bar ───────────────────────────────────────────────────────
  const pulse = new PulseStatusBar(storage);
  if (cfg.get<boolean>('showStatusBar') !== false) pulse.show();

  // ── Wire tracker → storage + pulse ───────────────────────────────────
  let lastEventTime = 0;
  let lastEvent: Parameters<typeof storage.recordActivity>[0] | null = null;

  tracker.on('activity', (event: Parameters<typeof storage.recordActivity>[0]) => {
    const now = Date.now();
    if (lastEventTime > 0 && lastEvent) {
      const elapsed = Math.min((now - lastEventTime) / 1000, idleMs / 1000);
      if (elapsed > 0 && elapsed < idleMs / 1000) {
        storage.recordActivity(lastEvent, elapsed);
      }
    }
    lastEventTime = now;
    lastEvent = event;
  });

  tracker.on('sessionStart', (ts: number) => {
    sessionStartTime = ts;
    // Tick every second during active session so status bar stays fresh
    if (sessionTickInterval) clearInterval(sessionTickInterval);
    sessionTickInterval = setInterval(() => {
      const extra = Math.floor((Date.now() - sessionStartTime) / 1000);
      pulse.onSessionTick(extra);
    }, 1000);
  });

  tracker.on('idle', () => {
    if (sessionTickInterval) clearInterval(sessionTickInterval);
    pulse.onSessionEnd();
    // Flush the last event
    if (lastEventTime > 0 && lastEvent) {
      const elapsed = Math.min((Date.now() - lastEventTime) / 1000, idleMs / 1000);
      if (elapsed > 0) storage.recordActivity(lastEvent, elapsed);
    }
    lastEventTime = 0;
    lastEvent = null;
  });

  // ── Configuration change handler ──────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('keystrand')) return;
      const updated = vscode.workspace.getConfiguration('keystrand');
      tracker.updateIdleThreshold((updated.get<number>('idleThresholdSeconds') ?? 120) * 1000);
      tracker.updateAiThreshold(updated.get<number>('aiDetectionThreshold') ?? 5);
      pulse.updateVisibility(updated.get<boolean>('showStatusBar') !== false);
    })
  );

  // ── Commands ──────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('keystrand.openDashboard', () => {
      DashboardPanel.createOrShow(context, storage);
    }),

    vscode.commands.registerCommand('keystrand.generateStrand', () => {
      StrandGenerator.show(context, storage);
    }),

    vscode.commands.registerCommand('keystrand.exportData', async () => {
      const json = await storage.exportJson();
      const doc = await vscode.workspace.openTextDocument({
        content: json,
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Keystrand: Your data is displayed above. Save it anywhere you like.');
    }),

    vscode.commands.registerCommand('keystrand.resetData', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset all Keystrand data? This cannot be undone.',
        { modal: true },
        'Reset Everything'
      );
      if (confirm === 'Reset Everything') {
        await storage.resetAll();
        vscode.window.showInformationMessage('Keystrand: All data has been reset.');
      }
    })
  );

  // ── First-run welcome ─────────────────────────────────────────────────
  const isNew = !context.globalState.get('keystrand.welcomed');
  if (isNew) {
    await context.globalState.update('keystrand.welcomed', true);
    const action = await vscode.window.showInformationMessage(
      '✨ Keystrand is running — tracking your coding locally. No account needed, no data leaves your machine.',
      'Open Dashboard'
    );
    if (action === 'Open Dashboard') {
      DashboardPanel.createOrShow(context, storage);
    }
  }

  // ── Register disposables ──────────────────────────────────────────────
  context.subscriptions.push(
    { dispose: () => tracker.dispose() },
    { dispose: () => pulse.dispose() },
    { dispose: () => { if (sessionTickInterval) clearInterval(sessionTickInterval); } },
    { dispose: () => storage.dispose() }
  );
}

export function deactivate() {
  // Cleanup handled via subscriptions above
}
