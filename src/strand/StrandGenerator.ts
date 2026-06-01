import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from '../storage/StorageManager';
import { buildStrandHtml } from './strandContent';

type StrandPeriod = 'daily' | 'weekly' | 'monthly';
type StrandTheme = 'dark' | 'neon' | 'ocean' | 'forest';

export class StrandGenerator {
  static async show(context: vscode.ExtensionContext, storage: StorageManager): Promise<void> {
    const period = await vscode.window.showQuickPick(
      [
        { label: '$(calendar) Today', description: 'Daily summary', value: 'daily' as StrandPeriod },
        { label: '$(graph) This Week', description: 'Weekly summary', value: 'weekly' as StrandPeriod },
        { label: '$(history) This Month', description: 'Monthly summary', value: 'monthly' as StrandPeriod },
      ],
      { title: 'KaikeyTime: Generate Strand Card', placeHolder: 'Choose period' }
    );
    if (!period) return;

    const cfg = vscode.workspace.getConfiguration('kaikeytime');
    const theme = (cfg.get<string>('strandTheme') ?? 'dark') as StrandTheme;

    const panel = vscode.window.createWebviewPanel(
      'kaikeytime.strand',
      `Strand — ${period.label.replace(/\$\(\w+\)\s*/, '')}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, localResourceRoots: [] }
    );

    const data = StrandGenerator.buildData(storage, period.value);
    panel.webview.html = buildStrandHtml(data, theme);

    panel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'savePng') {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'Desktop', `kaikeytime-strand.png`)),
          filters: { 'PNG Image': ['png'] },
          saveLabel: 'Save Strand Card',
        });
        if (!uri) return;
        const base64 = (msg.data as string).replace(/^data:image\/png;base64,/, '');
        const buf = Buffer.from(base64, 'base64');
        await vscode.workspace.fs.writeFile(uri, buf);
        const action = await vscode.window.showInformationMessage(
          '✨ Strand card saved! Share it on LinkedIn or X.',
          'Open File'
        );
        if (action === 'Open File') {
          await vscode.env.openExternal(uri);
        }
      } else if (msg.type === 'changeTheme') {
        await vscode.workspace.getConfiguration('kaikeytime').update('strandTheme', msg.theme, true);
        const newData = StrandGenerator.buildData(storage, period.value);
        panel.webview.html = buildStrandHtml(newData, msg.theme as StrandTheme);
      }
    });
  }

  private static buildData(storage: StorageManager, period: StrandPeriod) {
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const statDays = storage.getLastNDays(days);
    const label = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

    const totalSeconds = statDays.reduce((s, d) => s + d.activeSeconds, 0);
    const totalLines = statDays.reduce((s, d) => s + d.linesAdded, 0);
    const totalAiLines = statDays.reduce((s, d) => s + d.aiLines, 0);
    const totalEditedLines = statDays.reduce((s, d) => s + d.totalEditedLines, 0);
    const aiPct = totalEditedLines > 50 ? Math.round((totalAiLines / totalEditedLines) * 100) : 0;

    // Aggregate language seconds
    const langMap: Record<string, number> = {};
    for (const day of statDays) {
      for (const [lang, stats] of Object.entries(day.languages)) {
        langMap[lang] = (langMap[lang] ?? 0) + stats.activeSeconds;
      }
    }
    const topLangs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const topLangName = topLangs[0]?.[0] ?? '—';
    const topLangPct = totalSeconds > 0 && topLangs[0]
      ? Math.round((topLangs[0][1] / totalSeconds) * 100) : 0;

    const allFiles = new Set(statDays.flatMap(d => d.filesEdited));
    const activeDays = statDays.filter(d => d.activeSeconds > 60).length;

    return {
      label,
      period,
      totalSeconds,
      totalLines,
      aiPct,
      topLangName,
      topLangPct,
      topLangs,
      streak: storage.getStreak(),
      longestStreak: storage.getLongestStreak(),
      filesCount: allFiles.size,
      activeDays,
    };
  }
}
