import fs from 'node:fs';
import path from 'node:path';

export interface LockMetadata {
  lockOwner: string;
  phaseId: string;
  acquiredAt: string;
  ttlMs: number;
  pid: number;
}

export interface ConcurrencyLockOptions {
  lockDir?: string;
  lockFileName?: string;
  defaultTtlMs?: number;
}

export class StageLockedCollisionError extends Error {
  readonly code = 'STAGE_LOCKED_COLLISION';
  readonly existingLock: LockMetadata;

  constructor(message: string, existingLock: LockMetadata) {
    super(message);
    this.name = 'StageLockedCollisionError';
    this.existingLock = existingLock;
  }
}

export class ConcurrencyLock {
  readonly lockDir: string;
  readonly lockFileName: string;
  readonly defaultTtlMs: number;

  constructor(options: ConcurrencyLockOptions = {}) {
    this.lockDir = path.resolve(options.lockDir || process.cwd());
    this.lockFileName = options.lockFileName || '.stage.lock';
    this.defaultTtlMs = options.defaultTtlMs ?? 60000;

    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }
  }

  get lockPath(): string {
    return path.join(this.lockDir, this.lockFileName);
  }

  private isProcessActive(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: any) {
      return err.code === 'EPERM';
    }
  }

  acquireLock(phaseId: string, lockOwner: string, ttlMs?: number): LockMetadata {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const metadata: LockMetadata = {
      lockOwner,
      phaseId,
      acquiredAt: new Date().toISOString(),
      ttlMs: effectiveTtl,
      pid: process.pid,
    };

    try {
      fs.writeFileSync(this.lockPath, JSON.stringify(metadata, null, 2), { flag: 'wx' });
      return metadata;
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }

      // Lock already exists -> inspect staleness and owner liveness
      let existing: LockMetadata | null = null;
      try {
        const raw = fs.readFileSync(this.lockPath, 'utf8');
        existing = JSON.parse(raw);
      } catch {
        // Corrupt lock file -> treated as stale
      }

      if (existing) {
        const elapsed = Date.now() - new Date(existing.acquiredAt).getTime();
        const isStale = elapsed > existing.ttlMs;
        const ownerAlive = this.isProcessActive(existing.pid);

        if (isStale && !ownerAlive) {
          // AC-U3-03: Reclaim stale lock safely
          try {
            fs.unlinkSync(this.lockPath);
          } catch {
            // ignore if raced
          }
          fs.writeFileSync(this.lockPath, JSON.stringify(metadata, null, 2), { flag: 'wx' });
          return metadata;
        }

        // AC-U3-02: Reject second acquisition with STAGE_LOCKED_COLLISION
        throw new StageLockedCollisionError(
          `STAGE_LOCKED_COLLISION: Phase "${existing.phaseId}" locked by "${existing.lockOwner}" (pid: ${existing.pid}, acquired: ${existing.acquiredAt})`,
          existing
        );
      } else {
        // Corrupt file was present; replace
        try {
          fs.unlinkSync(this.lockPath);
        } catch {
          // ignore
        }
        fs.writeFileSync(this.lockPath, JSON.stringify(metadata, null, 2), { flag: 'wx' });
        return metadata;
      }
    }
  }

  releaseLock(phaseId: string, lockOwner?: string): boolean {
    if (!fs.existsSync(this.lockPath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(this.lockPath, 'utf8');
      const existing: LockMetadata = JSON.parse(raw);
      if (existing.phaseId === phaseId && (!lockOwner || existing.lockOwner === lockOwner)) {
        fs.unlinkSync(this.lockPath);
        return true;
      }
    } catch {
      // Corrupt lock file
      try {
        fs.unlinkSync(this.lockPath);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  isLocked(): boolean {
    if (!fs.existsSync(this.lockPath)) return false;
    try {
      const raw = fs.readFileSync(this.lockPath, 'utf8');
      const existing: LockMetadata = JSON.parse(raw);
      const elapsed = Date.now() - new Date(existing.acquiredAt).getTime();
      const isStale = elapsed > existing.ttlMs;
      const ownerAlive = this.isProcessActive(existing.pid);
      if (isStale && !ownerAlive) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  getLockInfo(): LockMetadata | null {
    if (!fs.existsSync(this.lockPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.lockPath, 'utf8'));
    } catch {
      return null;
    }
  }
}
