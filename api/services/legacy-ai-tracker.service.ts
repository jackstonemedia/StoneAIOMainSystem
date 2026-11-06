import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

export interface LegacyAiUsageEntry {
  routeName: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
  count: number;
}

export interface LegacyAiFeatureReport {
  totalCalls: number;
  uniqueWorkspaces: number;
  byDate: Record<string, number>;
}

class LegacyAiTracker {
  private filePath: string;
  private entries: Map<string, LegacyAiUsageEntry> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'tmp', 'legacy_ai_usage.json');
    this.load();
  }

  private getKey(routeName: string, workspaceId: string, date: string): string {
    return `${routeName}::${workspaceId}::${date}`;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: LegacyAiUsageEntry[] = JSON.parse(raw);
        for (const item of list) {
          this.entries.set(this.getKey(item.routeName, item.workspaceId, item.date), item);
        }
      }
    } catch {
      // Graceful fallback if file is locked or missing
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.persist();
    }, 2000);
  }

  public persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.entries.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Graceful fallback
    }
  }

  public recordUsage(routeName: string, workspaceId: string = 'unknown'): void {
    const today = new Date().toISOString().slice(0, 10);
    const key = this.getKey(routeName, workspaceId, today);

    const existing = this.entries.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.entries.set(key, {
        routeName,
        workspaceId,
        date: today,
        count: 1,
      });
    }

    this.scheduleSave();
  }

  public getUsageReport(days: number = 30): Record<string, LegacyAiFeatureReport> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const report: Record<string, { totalCalls: number; workspaces: Set<string>; byDate: Record<string, number> }> = {};

    for (const entry of this.entries.values()) {
      if (entry.date >= cutoffStr) {
        if (!report[entry.routeName]) {
          report[entry.routeName] = {
            totalCalls: 0,
            workspaces: new Set<string>(),
            byDate: {},
          };
        }
        report[entry.routeName].totalCalls += entry.count;
        report[entry.routeName].workspaces.add(entry.workspaceId);
        report[entry.routeName].byDate[entry.date] = (report[entry.routeName].byDate[entry.date] || 0) + entry.count;
      }
    }

    const finalReport: Record<string, LegacyAiFeatureReport> = {};
    for (const [routeName, stat] of Object.entries(report)) {
      finalReport[routeName] = {
        totalCalls: stat.totalCalls,
        uniqueWorkspaces: stat.workspaces.size,
        byDate: stat.byDate,
      };
    }

    return finalReport;
  }

  public resetForTesting(): void {
    this.entries.clear();
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }
}

export const legacyAiTracker = new LegacyAiTracker();

/** Express middleware for non-intrusively counting hits to legacy AI endpoints */
export function trackLegacyAi(routeName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const workspaceId = (req as Request & { workspaceId?: string }).workspaceId || 'unknown';
      legacyAiTracker.recordUsage(routeName, workspaceId);
    } catch {
      // never fail a request for metrics
    }
    next();
  };
}
