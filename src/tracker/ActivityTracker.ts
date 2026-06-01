import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ActivityEvent } from './types';

export class ActivityTracker extends EventEmitter {
  private lastActivityTime = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private _isActive = false;
  private sessionStart = 0;
  private disposables: vscode.Disposable[] = [];

  constructor(private idleThresholdMs: number, private aiLineThreshold: number) {
    super();
  }

  start() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.contentChanges.length === 0 || e.document.uri.scheme !== 'file') return;

        const doc = e.document;
        const language = doc.languageId;
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        const project = folder?.name ?? 'untitled';

        let linesAdded = 0;
        let linesRemoved = 0;
        let charsAdded = 0;
        let isLikelyAI = false;

        for (const change of e.contentChanges) {
          const newLineCount = (change.text.match(/\n/g) ?? []).length;
          const removedLineCount = change.range.end.line - change.range.start.line;

          linesAdded += newLineCount;
          linesRemoved += removedLineCount;
          charsAdded += change.text.length;

          // Large single-shot insertions are characteristic of AI completions / pastes
          // N lines = N-1 newlines; subtract 1 so threshold means "lines", not "newlines"
          if (newLineCount >= Math.max(1, this.aiLineThreshold - 1) || change.text.length >= 300) {
            isLikelyAI = true;
          }
        }

        this.onActivity({
          timestamp: Date.now(),
          language,
          project,
          filePath: doc.uri.fsPath,
          linesAdded,
          linesRemoved,
          charsAdded,
          isLikelyAI,
        });
      }),

      vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.scheme !== 'file') return;
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        this.onActivity({
          timestamp: Date.now(),
          language: doc.languageId,
          project: folder?.name ?? 'untitled',
          filePath: doc.uri.fsPath,
          linesAdded: 0,
          linesRemoved: 0,
          charsAdded: 0,
          isLikelyAI: false,
        });
      }),

      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!editor || editor.document.uri.scheme !== 'file') return;
        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        this.onActivity({
          timestamp: Date.now(),
          language: editor.document.languageId,
          project: folder?.name ?? 'untitled',
          filePath: editor.document.uri.fsPath,
          linesAdded: 0,
          linesRemoved: 0,
          charsAdded: 0,
          isLikelyAI: false,
        });
      })
    );
  }

  private onActivity(event: ActivityEvent) {
    const now = event.timestamp;

    if (!this._isActive) {
      this._isActive = true;
      this.sessionStart = now;
      this.emit('sessionStart', now);
    }

    this.lastActivityTime = now;
    this.emit('activity', event);

    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this._isActive = false;
      this.emit('idle', Date.now());
    }, this.idleThresholdMs);
  }

  get isActive() { return this._isActive; }
  get sessionStartTime() { return this.sessionStart; }
  get lastActivity() { return this.lastActivityTime; }

  updateIdleThreshold(ms: number) { this.idleThresholdMs = ms; }
  updateAiThreshold(lines: number) { this.aiLineThreshold = lines; }

  dispose() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.disposables.forEach(d => d.dispose());
  }
}
