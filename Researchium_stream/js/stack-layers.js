/**
 * Researchium Stream — platform layer model
 * Top (UI) → bottom (cloud); drives stack UI + code preview.
 */
(function (global) {
  const RESEARCH_STACK = [
    {
      id: 'ui',
      label: 'Frontend UI',
      short: 'Dashboards, studio, Q&A, analytics',
      color: '#8b5cf6',
      snippet: `// Layer 1 — presentation
export const StreamDashboard = {
  mount(el, { roomId, profile }) {
    return Researchium.UI.render(el, {
      components: ['Studio', 'ChatFeed', 'Destinations', 'Metrics'],
      roomId,
      orcid: profile.orcid,
    });
  },
};`,
    },
    {
      id: 'hci',
      label: 'HCI + Visualization Research',
      short: 'Attention, accessibility, live data overlays',
      color: '#5ad4ff',
      snippet: `// Layer 2 — human factors
export function layoutSessionView(metrics) {
  return {
    primary: metrics.activeSpeaker,
    secondary: ['slides', 'labCam', 'spectrogram'],
    a11y: { captions: true, contrast: 'AAA' },
  };
}`,
    },
    {
      id: 'webrtc',
      label: 'WebRTC + Streaming Research',
      short: 'Signaling, SFU, RTMP egress, simulcast',
      color: '#8b5cf6',
      snippet: `// Layer 3 — real-time media
import { SignalingClient } from './signaling.js';
import { SFUTransport } from './sfu.js';

export async function joinBroadcastRoom(roomId, localTracks) {
  const signal = new SignalingClient({ roomId });
  const transport = await SFUTransport.connect(signal, localTracks);
  return { signal, transport, egress: transport.rtmpFanout() };
}`,
    },
    {
      id: 'distributed',
      label: 'Distributed Systems',
      short: 'Rooms, buses, replication, geo routing',
      color: '#9b7aff',
      snippet: `// Layer 4 — scale & coordination
export class RoomCoordinator {
  async admit(peerId, roomId) {
    const shard = await this.router.shardFor(roomId);
    return shard.assign(peerId, { role: 'presenter' });
  }
}`,
    },
    {
      id: 'ai',
      label: 'AI / NLP Systems',
      short: 'Transcripts, Q&A rank, moderation, clips',
      color: '#f0c040',
      snippet: `// Layer 5 — intelligence
export async function enrichLiveSession({ transcript, chat }) {
  return {
    chapters: await NLP.segment(transcript),
    rankedQuestions: await NLP.rankPeerQA(chat),
    entities: await NLP.extractTopics(transcript),
  };
}`,
    },
    {
      id: 'kg',
      label: 'Knowledge Graphs',
      short: 'Researchers, topics, papers, stream lineage',
      color: '#10b981',
      snippet: `// Layer 6 — scholarly semantics
export const ScholarGraph = {
  linkStream(streamId, { orcid, dois, topics }) {
    return KG.merge({
      nodes: [{ type: 'Stream', id: streamId }, { type: 'Researcher', orcid }],
      edges: ['PRESENTS', 'CITES', 'TAGGED'],
    });
  },
};`,
    },
    {
      id: 'cloud',
      label: 'Cloud Infrastructure',
      short: 'K8s, CDN, TURN, object storage, observability',
      color: '#7278a8',
      snippet: `// Layer 7 — platform
export const infra = {
  regions: ['eu-west', 'us-east', 'ap-south'],
  services: ['sfu-pool', 'signaling', 'rtmp-edge', 'ml-workers'],
  turn: process.env.TURN_URIS,
};`,
    },
  ];

  const WEBRTC_PIPELINE = [
    { id: 'browser', label: 'Browser', role: 'capture + encode' },
    { id: 'signaling', label: 'Signaling Server', role: 'SDP / ICE exchange' },
    { id: 'peer', label: 'WebRTC Peer Connections', role: 'SRTP media plane' },
    { id: 'sfu', label: 'SFU', role: 'selective forward' },
    { id: 'participants', label: 'Multiple Participants', role: 'N viewers & co-hosts' },
  ];

  global.Researchium = global.Researchium || {};
  global.Researchium.StackLayers = { RESEARCH_STACK, WEBRTC_PIPELINE };
})(typeof window !== 'undefined' ? window : globalThis);
