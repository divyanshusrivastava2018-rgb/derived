import { spawn } from 'child_process';
import { log } from '../../lib/logger.js';
import { getRtmpInternalBase } from './ingest.js';

const distributors = new Map();

function buildFfmpegArgs(inputUrl, targets) {
  const args = ['-hide_banner', '-loglevel', 'warning', '-re', '-i', inputUrl];

  for (const t of targets) {
    if (!t?.rtmpUrl) continue;
    const out = t.streamKey && !t.rtmpUrl.includes(t.streamKey)
      ? `${t.rtmpUrl.replace(/\/$/, '')}/${t.streamKey}`
      : t.rtmpUrl;
    args.push('-c', 'copy', '-f', 'flv', out);
  }

  return args;
}

export function startDistribution(streamKey, targets, { userId } = {}) {
  if (!streamKey || !targets?.length) {
    throw new Error('stream_key_and_targets_required');
  }

  stopDistribution(streamKey);

  const inputUrl = `${getRtmpInternalBase()}/${streamKey}`;
  const validTargets = targets.filter((t) => t.rtmpUrl);
  if (!validTargets.length) throw new Error('no_valid_rtmp_targets');

  const args = buildFfmpegArgs(inputUrl, validTargets);
  log.info(`RTMP distribute ${streamKey} → ${validTargets.length} outputs`);

  const proc = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const state = {
    streamKey,
    userId,
    pid: proc.pid,
    targets: validTargets.map((t) => t.platform || 'unknown'),
    startedAt: Date.now(),
  };

  proc.stderr.on('data', (chunk) => {
    const line = chunk.toString();
    if (line.includes('error') || line.includes('Error')) {
      log.warn(`ffmpeg[${streamKey}]: ${line.trim()}`);
    }
  });

  proc.on('exit', (code) => {
    log.info(`ffmpeg distributor ${streamKey} exited code=${code}`);
    distributors.delete(streamKey);
  });

  distributors.set(streamKey, { proc, state });
  return state;
}

export function stopDistribution(streamKey) {
  const entry = distributors.get(streamKey);
  if (!entry) return false;
  try {
    entry.proc.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  distributors.delete(streamKey);
  return true;
}

export function stopAllForUser(userId) {
  for (const [key, entry] of distributors) {
    if (entry.state.userId === userId) stopDistribution(key);
  }
}

export function getDistributionStatus(streamKey) {
  const entry = distributors.get(streamKey);
  if (!entry) return { running: false, streamKey };
  return { running: true, ...entry.state };
}

export function listDistributions() {
  return [...distributors.values()].map((e) => e.state);
}
