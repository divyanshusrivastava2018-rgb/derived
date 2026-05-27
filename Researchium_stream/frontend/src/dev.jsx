import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformConnectionManager } from './components/PlatformConnectionManager';
import { UnifiedChatRoom } from './components/UnifiedChatRoom';
import { StreamControlPanel } from './components/StreamControlPanel';
import { ViewerCounter } from './components/ViewerCounter';
import './styles/components.css';

const params = new URLSearchParams(location.search);
const roomSlug =
  params.get('room') ||
  JSON.parse(sessionStorage.getItem('researchium_studio_session') || '{}').roomSlug ||
  'demo-room';

createRoot(document.getElementById('platforms')).render(
  <PlatformConnectionManager showGoLive />
);
createRoot(document.getElementById('viewers')).render(
  <ViewerCounter roomSlug={roomSlug} intervalMs={5000} />
);
createRoot(document.getElementById('controls')).render(
  <StreamControlPanel roomSlug={roomSlug} title="Dev stream" />
);
createRoot(document.getElementById('chat')).render(
  <UnifiedChatRoom roomSlug={roomSlug} authorName="Host" />
);
