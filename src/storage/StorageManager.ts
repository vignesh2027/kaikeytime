import * as vscode from 'vscode';
import { ActivityEvent, DayStats, StoredData } from '../tracker/types';

const DATA_FILE = 'kaikeytime-data.json';
const VERSION = 1;

export function toDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyDay(date: string): DayStats {
  return {
    date,
    activeSeconds: 0,
    linesAdded: 0,
    linesRemoved: 0,
    filesEdited: [],
    aiLines: 0,
    totalEditedLines: 0,
    languages: {},
    projects: {},
    hourlyActivity: new Array(24).fill(0),
  };
}

function emptyData(): StoredData {
  return {
    version: VERSION,
    days: {},
    streak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    weeklyHeatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    createdAt: Date.now(),
    totalLifetimeSeconds: 0,
  };
}

export class StorageManager {
  private data: StoredData = emptyData();
  private dataPath: vscode.Uri;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(storageUri: vscode.Uri) {
    this.dataPath = vscode.Uri.joinPath(storageUri, DATA_FILE);
  }

  async load(): Promise<void> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.dataPath);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as StoredData;
      // Ensure new fields exist for older data files
      if (!parsed.weeklyHeatmap) {
        parsed.weeklyHeatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
      }
      if (parsed.totalLifetimeSeconds === undefined) parsed.totalLifetimeSeconds = 0;
      this.data = parsed;
    } catch {
      this.data = emptyData();
    }
  }

  async save(): Promise<void> {
    try {
      const dir = vscode.Uri.joinPath(this.dataPath, '..');
      await vscode.workspace.fs.createDirectory(dir);
      const raw = Buffer.from(JSON.stringify(this.data, null, 2), 'utf8');
      await vscode.workspace.fs.writeFile(this.dataPath, raw);
      this.dirty = false;
    } catch (err) {
      console.error('[KaikeyTime] Save failed:', err);
    }
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 4000);
  }

  /** Record a burst of activity (called ~once per second while active) */
  recordActivity(event: ActivityEvent, durationSeconds: number): void {
    const day = this.getOrCreateDay(toDateStr());
    const hour = new Date().getHours();
    const dow = new Date().getDay(); // 0=Sunday

    day.activeSeconds += durationSeconds;
    day.linesAdded += event.linesAdded;
    day.linesRemoved += event.linesRemoved;
    day.totalEditedLines += event.linesAdded;
    if (event.isLikelyAI) day.aiLines += event.linesAdded;
    if (!day.filesEdited.includes(event.filePath)) {
      day.filesEdited.push(event.filePath);
    }

    // Language
    if (event.language && event.language !== 'plaintext') {
      const lang = (day.languages[event.language] ??= { activeSeconds: 0, linesAdded: 0 });
      lang.activeSeconds += durationSeconds;
      lang.linesAdded += event.linesAdded;
    }

    // Project
    if (event.project) {
      const proj = (day.projects[event.project] ??= { activeSeconds: 0, linesAdded: 0, filesEdited: [] });
      proj.activeSeconds += durationSeconds;
      proj.linesAdded += event.linesAdded;
      if (!proj.filesEdited.includes(event.filePath)) proj.filesEdited.push(event.filePath);
    }

    // Heatmaps
    day.hourlyActivity[hour] += durationSeconds;
    this.data.weeklyHeatmap[dow][hour] += durationSeconds;
    this.data.totalLifetimeSeconds += durationSeconds;

    this.updateStreak();
    this.scheduleSave();
  }

  private getOrCreateDay(date: string): DayStats {
    return (this.data.days[date] ??= emptyDay(date));
  }

  private updateStreak(): void {
    const today = toDateStr();
    if (this.data.lastActiveDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toDateStr(yesterday);

    if (this.data.lastActiveDate === yStr) {
      this.data.streak += 1;
    } else if (this.data.lastActiveDate !== today) {
      this.data.streak = 1;
    }

    if (this.data.streak > this.data.longestStreak) {
      this.data.longestStreak = this.data.streak;
    }

    this.data.lastActiveDate = today;
  }

  getTodayStats(): DayStats {
    return this.data.days[toDateStr()] ?? emptyDay(toDateStr());
  }

  getLastNDays(n: number): DayStats[] {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      const key = toDateStr(d);
      return this.data.days[key] ?? emptyDay(key);
    });
  }

  getStreak(): number { return this.data.streak; }
  getLongestStreak(): number { return this.data.longestStreak; }
  getTotalLifetimeSeconds(): number { return this.data.totalLifetimeSeconds; }
  getWeeklyHeatmap(): number[][] { return this.data.weeklyHeatmap; }
  getAllData(): StoredData { return this.data; }

  async exportJson(): Promise<string> {
    return JSON.stringify(this.data, null, 2);
  }

  async resetAll(): Promise<void> {
    this.data = emptyData();
    await this.save();
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.dirty) void this.save();
  }
}
