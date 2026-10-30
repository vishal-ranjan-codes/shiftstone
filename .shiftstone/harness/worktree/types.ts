export type WorktreeStatus = 'active' | 'removing' | 'orphaned';

export interface WorktreeRecord {
  phaseId: string;
  branch: string;
  path: string;
  sourcePaths: string[];
  createdAt: string;
  status: WorktreeStatus;
}

export interface WorktreeEngineOptions {
  root?: string;
  worktreePrefix?: string;
  gitExecutable?: string;
}

export class DisjointPathViolationError extends Error {
  code = 'DISJOINT_PATH_VIOLATION';
  phaseId: string;
  conflictingPhaseId: string;
  collidingPath: string;

  constructor(message: string, phaseId: string, conflictingPhaseId: string, collidingPath: string) {
    super(message);
    this.name = 'DisjointPathViolationError';
    this.phaseId = phaseId;
    this.conflictingPhaseId = conflictingPhaseId;
    this.collidingPath = collidingPath;
  }
}
