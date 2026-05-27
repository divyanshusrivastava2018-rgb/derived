/**
 * FFmpeg ABR + HLS worker stub.
 * Ingress must be on a trusted network only — never expose RTP to the public internet.
 */
const INGRESS = process.env.FFMPEG_INGRESS || 'rtp://127.0.0.1:5004';
const HLS_OUT = process.env.HLS_OUT || '/var/hls/live';

if (process.env.NODE_ENV === 'production' && !process.env.FFMPEG_INGRESS) {
  console.error('[transcode] FFMPEG_INGRESS must be set in production');
  process.exit(1);
}

console.log('[transcode] worker ready (configure ingress on private network)');
console.log(`  ingress: ${INGRESS}`);
console.log(`  hls out: ${HLS_OUT}`);
