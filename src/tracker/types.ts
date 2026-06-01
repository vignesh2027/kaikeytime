export interface ActivityEvent {
  timestamp: number;
  language: string;
  project: string;
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  charsAdded: number;
  /** True when a single edit inserts many lines at once — characteristic of AI completion or paste */
  isLikelyAI: boolean;
}

export interface LangDay {
  activeSeconds: number;
  linesAdded: number;
}

export interface ProjectDay {
  activeSeconds: number;
  linesAdded: number;
  filesEdited: string[];
}

export interface DayStats {
  date: string; // YYYY-MM-DD
  activeSeconds: number;
  linesAdded: number;
  linesRemoved: number;
  filesEdited: string[];
  /** Lines flagged as likely AI-generated */
  aiLines: number;
  /** All lines added (for ratio denominator) */
  totalEditedLines: number;
  languages: Record<string, LangDay>;
  projects: Record<string, ProjectDay>;
  /** Seconds active per hour of the day (index 0–23) */
  hourlyActivity: number[];
}

export interface StoredData {
  version: number;
  days: Record<string, DayStats>; // keyed YYYY-MM-DD
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  /** [7][24]: seconds active per (day-of-week × hour), rolling all-time */
  weeklyHeatmap: number[][];
  createdAt: number;
  totalLifetimeSeconds: number;
}
