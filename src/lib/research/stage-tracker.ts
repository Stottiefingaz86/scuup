import type { JourneyMetrics, JourneyStageResult } from "./types";

/** Minimal job shape the stopwatch writes into. */
export interface TrackableJourneyJob {
  steps: string[];
  stages: JourneyStageResult[];
  metrics: JourneyMetrics;
}

/** Stopwatch + click/wait counters for every journey stage. */
export class JourneyStageTracker {
  private steps = new Map<string, number>();
  private waits = new Map<string, number>();

  /** Runs after every timed wait — cheap DOM watchers (welcome popups…). */
  idleWatcher: ((page: unknown) => Promise<void>) | null = null;
  private watcherBusy = false;

  constructor(private job: TrackableJourneyJob) {}

  push(message: string) {
    this.job.steps.push(message);
  }

  stage(stageId: string): JourneyStageResult | undefined {
    return this.job.stages.find((s) => s.stageId === stageId);
  }

  begin(stageId: string) {
    const s = this.stage(stageId);
    if (!s) return;
    s.startedAt = new Date().toISOString();
    s.endedAt = null;
    s.timeSec = null;
  }

  addStep(stageId: string, count = 1) {
    this.steps.set(stageId, (this.steps.get(stageId) ?? 0) + count);
  }

  addWait(stageId: string, seconds: number) {
    this.waits.set(stageId, (this.waits.get(stageId) ?? 0) + seconds);
  }

  async wait(
    page: { waitForTimeout: (ms: number) => Promise<void> },
    ms: number,
    stageId?: string,
  ) {
    await page.waitForTimeout(ms);
    if (stageId) this.addWait(stageId, Math.round(ms / 1000));
    if (this.idleWatcher && !this.watcherBusy) {
      this.watcherBusy = true;
      try {
        await this.idleWatcher(page);
      } catch {
        // watchers are best-effort
      } finally {
        this.watcherBusy = false;
      }
    }
  }

  end(stageId: string, patch: Partial<JourneyStageResult> = {}) {
    const s = this.stage(stageId);
    if (!s) return;
    s.endedAt = new Date().toISOString();
    if (s.startedAt) {
      s.timeSec = Math.max(
        0,
        Math.round(
          (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
            1000,
        ),
      );
    }
    const steps = patch.steps ?? this.steps.get(stageId) ?? 0;
    const waitSec = patch.waitSec ?? this.waits.get(stageId) ?? 0;
    Object.assign(s, patch, { steps, waitSec });
    this.steps.delete(stageId);
    this.waits.delete(stageId);
    this.recomputeMetrics();
  }

  skip(
    stageId: string,
    reason: string,
    severity: JourneyStageResult["severity"] = "high",
  ) {
    this.begin(stageId);
    this.end(stageId, {
      steps: 0,
      waitSec: 0,
      friction: reason,
      severity,
      evidence: "Skipped",
    });
    this.push(`${stageId}: skipped — ${reason}`);
  }

  recomputeMetrics() {
    const timed = this.job.stages.filter((s) => s.timeSec != null);
    this.job.metrics.totalTimeSec = timed.reduce(
      (a, s) => a + (s.timeSec ?? 0),
      0,
    );
    this.job.metrics.totalScreens = timed.filter(
      (s) => s.evidence !== "Skipped",
    ).length;
    this.job.metrics.totalActions = timed.reduce(
      (a, s) => a + (s.steps ?? 0),
      0,
    );
    this.job.metrics.totalFormFields = timed.reduce(
      (a, s) => a + (s.fieldCount ?? 0),
      0,
    );
    this.job.metrics.totalWaitSec = timed.reduce(
      (a, s) => a + (s.waitSec ?? 0),
      0,
    );
    this.job.metrics.redirects = timed.reduce(
      (a, s) => a + (s.redirects ?? 0),
      0,
    );
    this.job.metrics.errors = timed.reduce(
      (a, s) => a + (s.errorCount ?? 0),
      0,
    );

    const depositDone = this.job.stages.find(
      (s) => s.stageId === "deposit_confirmation" && s.endedAt,
    );
    const firstBet = this.job.stages.find(
      (s) => s.stageId === "first_bet" && s.endedAt,
    );
    if (depositDone?.endedAt && firstBet?.endedAt) {
      this.job.metrics.depositToFirstBetSec = Math.max(
        0,
        Math.round(
          (new Date(firstBet.endedAt).getTime() -
            new Date(depositDone.endedAt).getTime()) /
            1000,
        ),
      );
    }
    const postDeposit = ["casino_discovery", "game_launch", "first_bet"];
    this.job.metrics.depositToFirstBetClicks = postDeposit.reduce(
      (a, id) => a + (this.stage(id)?.steps ?? 0),
      0,
    );
  }
}
