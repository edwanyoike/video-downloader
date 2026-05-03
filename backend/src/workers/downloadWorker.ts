import Bull from 'bull';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DownloadJobData, JobProgressData } from '../types';
import { classifyYtdlpError } from '../lib/ytdlpErrorMapper';
import { PLATFORM_REGISTRY } from '../platforms/registry';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/vd-jobs';
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10);
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const JOB_TIMEOUT_MS = 60_000;
const FILE_CLEANUP_DELAY_MS = 60_000;
const ORPHAN_CLEANUP_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const downloadQueue = new Bull<DownloadJobData>('downloads', REDIS_URL);

// Startup sweep: remove orphaned temp directories older than 10 minutes
export async function cleanupOrphanedDirs(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const entries = await fs.readdir(TEMP_DIR, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(TEMP_DIR, entry.name);
      try {
        const stat = await fs.stat(dirPath);
        if (now - stat.mtimeMs > ORPHAN_CLEANUP_AGE_MS) {
          await fs.rm(dirPath, { recursive: true, force: true });
        }
      } catch {
        // ignore stat errors
      }
    }
  } catch {
    // ignore if TEMP_DIR doesn't exist yet
  }
}

// Process download jobs
downloadQueue.process(MAX_CONCURRENT_JOBS, async (job) => {
  const { url, platformId, formatId, options } = job.data;
  const jobDir = path.join(TEMP_DIR, job.id.toString());

  await fs.mkdir(jobDir, { recursive: true });

  const platformConfig = PLATFORM_REGISTRY.get(platformId);
  const ytdlpArgs = platformConfig
    ? platformConfig.ytdlpArgs({ formatId, ...options })
    : [
        '--no-playlist',
        '--socket-timeout', '15',
        '-f', formatId || 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
      ];

  // Add output template
  const outputTemplate = path.join(jobDir, '%(title)s.%(ext)s');
  const args = [...ytdlpArgs, '-o', outputTemplate, url];

  return new Promise<string>((resolve, reject) => {
    const child = spawn(YTDLP_PATH, args, { shell: false, cwd: jobDir });

    let stderr = '';
    let lastPercent = 0;

    child.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString('utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const progress = JSON.parse(trimmed) as Partial<JobProgressData>;
          const percent = typeof progress.percent === 'number'
            ? Math.max(lastPercent, Math.min(100, progress.percent))
            : lastPercent;
          lastPercent = percent;
          job.progress({
            stage: progress.stage || 'downloading',
            percent,
            eta: progress.eta,
            speed: progress.speed,
          } as JobProgressData).catch(() => {});
        } catch {
          // not JSON progress line, ignore
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(classifyYtdlpError('', -1));
    }, JOB_TIMEOUT_MS);

    child.on('close', async (exitCode: number | null) => {
      clearTimeout(timer);
      const code = exitCode ?? 1;

      if (code !== 0) {
        reject(classifyYtdlpError(stderr, code));
        return;
      }

      // Find the output file
      try {
        const files = await fs.readdir(jobDir);
        const outputFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
        if (!outputFile) {
          reject(classifyYtdlpError('No output file found', 1));
          return;
        }
        const filePath = path.join(jobDir, outputFile);
        await job.progress({ stage: 'complete', percent: 100, fileReady: true } as JobProgressData);
        resolve(filePath);
      } catch {
        reject(classifyYtdlpError('Failed to locate output file', 1));
      }
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(classifyYtdlpError(err.message, 1));
    });
  });
});

// Resource cleanup on job completion — delete temp dir after 60s
downloadQueue.on('completed', (job) => {
  const jobDir = path.join(TEMP_DIR, job.id.toString());
  setTimeout(() => {
    fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }, FILE_CLEANUP_DELAY_MS);
});

// Resource cleanup on job failure — delete temp dir immediately
downloadQueue.on('failed', (job) => {
  if (!job) return;
  const jobDir = path.join(TEMP_DIR, job.id.toString());
  fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
});

export function getJobDir(jobId: string): string {
  return path.join(TEMP_DIR, jobId);
}
