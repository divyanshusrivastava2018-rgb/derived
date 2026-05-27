/**
 * Production deployment topology — React → Signaling/API → SFU → FFmpeg → HLS → CDN
 */
(function (global) {
  const DEPLOYMENT_NODES = [
    {
      id: 'react',
      label: 'React Frontend',
      sub: 'Next.js + WebRTC',
      x: 0.5,
      y: 0.07,
      color: '#8b5cf6',
      snippet: `// apps/web — Next.js + WebRTC client
'use client';
import { useRoom } from '@/lib/useRoom';

export default function StudioPage({ params }) {
  const { join, localStream, peers } = useRoom(params.roomId);
  return (
  <StudioLayout onJoin={join} localStream={localStream} peers={peers} />
  );
}`,
    },
    {
      id: 'signaling',
      label: 'Signaling Server',
      sub: 'Socket.IO',
      x: 0.28,
      y: 0.26,
      color: '#8b5cf6',
      snippet: `// services/signaling — JWT + targeted relay
io.use((socket, next) => {
  socket.data = verifyRoomToken(socket.handshake.auth.token);
  next();
});
socket.on('signal', ({ targetPeerId, payload }) => {
  io.to(registry.getSocketId(roomId, targetPeerId))
    .emit('signal', { fromPeerId: peerId, payload });
});`,
    },
    {
      id: 'api',
      label: 'API Gateway',
      sub: 'Express / NestJS',
      x: 0.72,
      y: 0.26,
      color: '#5ad4ff',
      snippet: `// services/api — JWT room tokens + validated queries
app.post('/api/auth/room-token', requireApiKey, (req, res) => {
  const token = signRoomToken({ peerId, roomId, role });
  res.json({ token, peerId });
});
app.get('/api/streams/:id', async (req, res) => {
  assertUuid(req.params.id);
  // parameterized SQL…
});`,
    },
    {
      id: 'postgres',
      label: 'PostgreSQL',
      sub: 'Research Graph',
      x: 0.72,
      y: 0.4,
      color: '#10b981',
      snippet: `-- research graph schema (excerpt)
CREATE TABLE researchers (id UUID PRIMARY KEY, orcid TEXT UNIQUE);
CREATE TABLE streams (id UUID PRIMARY KEY, host_id UUID REFERENCES researchers);
CREATE TABLE stream_edges (from_id UUID, to_id UUID, rel TEXT);`,
    },
    {
      id: 'sfu',
      label: 'mediasoup SFU',
      sub: 'WebRTC Routing',
      x: 0.28,
      y: 0.48,
      color: '#9b7aff',
      snippet: `// services/sfu — mediasoup worker + router
const worker = await mediasoup.createWorker();
const router = await worker.createRouter({ mediaCodecs });
const transport = await router.createWebRtcTransport({ listenIps });`,
    },
    {
      id: 'ffmpeg',
      label: 'FFmpeg Cluster',
      sub: 'ABR Transcoding',
      x: 0.28,
      y: 0.62,
      color: '#f0c040',
      snippet: `// services/transcode — simulcast → ABR ladder
ffmpeg -i rtp://ingress -c:v libx264 -preset veryfast \\
  -map 0:v -s 1920x1080 -b:v 4500k -f hls stream_1080.m3u8 \\
  -map 0:v -s 1280x720  -b:v 2500k -f hls stream_720.m3u8`,
    },
    {
      id: 'hls',
      label: 'HLS Generator',
      sub: 'segment + playlist',
      x: 0.28,
      y: 0.76,
      color: '#BA7517',
      snippet: `// HLS packaging
const playlist = new HLSPlaylist({
  segmentDuration: 2,
  paths: ['1080p', '720p', '480p'],
  outputDir: process.env.HLS_OUT,
});`,
    },
    {
      id: 'cdn',
      label: 'CDN / NGINX',
      sub: 'edge delivery',
      x: 0.28,
      y: 0.9,
      color: '#7278a8',
      snippet: `# deploy/nginx — HLS edge
location /live/ {
  types { application/vnd.apple.mpegurl m3u8; }
  root /var/hls;
  add_header Cache-Control "public, max-age=2";
}`,
    },
  ];

  const DEPLOYMENT_EDGES = [
    { from: 'react', to: 'signaling', label: 'WebSocket Signaling' },
    { from: 'react', to: 'api', label: 'HTTPS / REST' },
    { from: 'api', to: 'postgres', label: 'SQL' },
    { from: 'signaling', to: 'sfu', label: 'control' },
    { from: 'sfu', to: 'ffmpeg', label: 'RTP / pipe' },
    { from: 'ffmpeg', to: 'hls', label: 'segments' },
    { from: 'hls', to: 'cdn', label: 'origin push' },
  ];

  global.Researchium = global.Researchium || {};
  global.Researchium.InfraStack = { DEPLOYMENT_NODES, DEPLOYMENT_EDGES };
})(typeof window !== 'undefined' ? window : globalThis);
