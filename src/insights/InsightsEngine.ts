import { DayStats } from '../tracker/types';

export interface Insight {
  icon: string;
  text: string;
  type: 'positive' | 'neutral' | 'tip';
}

export function generateInsights(today: DayStats, weekDays: DayStats[], streak: number): Insight[] {
  const insights: Insight[] = [];

  // Best focus hour today
  const bestHour = today.hourlyActivity.indexOf(Math.max(...today.hourlyActivity));
  if (today.activeSeconds > 300 && bestHour >= 0) {
    const label = bestHour === 0 ? '12am' : bestHour < 12 ? `${bestHour}am` : bestHour === 12 ? '12pm' : `${bestHour - 12}pm`;
    insights.push({ icon: '⚡', text: `You focus best around ${label} — that's your peak hour today.`, type: 'positive' });
  }

  // Streak encouragement
  if (streak >= 7) {
    insights.push({ icon: '🔥', text: `${streak}-day streak! You're on a serious roll.`, type: 'positive' });
  } else if (streak >= 3) {
    insights.push({ icon: '✨', text: `${streak} days in a row — great consistency!`, type: 'positive' });
  } else if (streak === 1) {
    insights.push({ icon: '🌱', text: `Day 1 of your new streak. Every great run starts here.`, type: 'neutral' });
  }

  // Projects touched today
  const projectCount = Object.keys(today.projects).length;
  if (projectCount > 1) {
    insights.push({ icon: '🗂️', text: `You touched ${projectCount} projects today — nice context-switching.`, type: 'neutral' });
  }

  // AI assist ratio insight
  if (today.totalEditedLines > 50) {
    const ratio = today.totalEditedLines > 0 ? Math.round((today.aiLines / today.totalEditedLines) * 100) : 0;
    if (ratio > 50) {
      insights.push({ icon: '🤖', text: `~${ratio}% AI-assisted code today. Pairing well with your AI tools.`, type: 'neutral' });
    } else if (ratio < 10 && today.linesAdded > 100) {
      insights.push({ icon: '✍️', text: `~${ratio}% AI-assisted — mostly handwritten today. Craft mode!`, type: 'positive' });
    }
  }

  // Weekly comparison
  const todayIdx = weekDays.length - 1;
  if (todayIdx > 0) {
    const avgPrev = weekDays.slice(0, todayIdx).reduce((s, d) => s + d.activeSeconds, 0) / todayIdx;
    if (today.activeSeconds > avgPrev * 1.2 && avgPrev > 0) {
      insights.push({ icon: '📈', text: `Today you're ${Math.round(((today.activeSeconds / avgPrev) - 1) * 100)}% more active than your weekly average.`, type: 'positive' });
    }
  }

  // Lines today
  if (today.linesAdded > 500) {
    insights.push({ icon: '💪', text: `${today.linesAdded.toLocaleString()} lines added today. Prolific session!`, type: 'positive' });
  }

  // Top language
  const langs = Object.entries(today.languages).sort((a, b) => b[1].activeSeconds - a[1].activeSeconds);
  if (langs.length > 0) {
    const [topLang, topStats] = langs[0];
    const pct = today.activeSeconds > 0 ? Math.round((topStats.activeSeconds / today.activeSeconds) * 100) : 0;
    if (pct > 60) {
      insights.push({ icon: '🎯', text: `${pct}% of your time in ${topLang} today — deep focus in one language.`, type: 'positive' });
    }
  }

  // Cap at 4 insights to avoid overwhelming
  return insights.slice(0, 4);
}
