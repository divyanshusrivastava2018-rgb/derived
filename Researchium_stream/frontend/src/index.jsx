import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformConnectionManager } from './components/PlatformConnectionManager';
import { UnifiedChatRoom } from './components/UnifiedChatRoom';
import { StreamControlPanel } from './components/StreamControlPanel';
import { ViewerCounter } from './components/ViewerCounter';
import './styles/components.css';

function mount(Component, el, props) {
  if (!el) return null;
  const root = createRoot(el);
  root.render(<Component {...props} />);
  return () => root.unmount();
}

export {
  PlatformConnectionManager,
  UnifiedChatRoom,
  StreamControlPanel,
  ViewerCounter,
};

export const mounts = {
  platformConnectionManager: (el, props) =>
    mount(PlatformConnectionManager, el, props),
  unifiedChatRoom: (el, props) => mount(UnifiedChatRoom, el, props),
  streamControlPanel: (el, props) => mount(StreamControlPanel, el, props),
  viewerCounter: (el, props) => mount(ViewerCounter, el, props),
};

if (typeof window !== 'undefined') {
  window.ResearchiumStreamComponents = {
    PlatformConnectionManager,
    UnifiedChatRoom,
    StreamControlPanel,
    ViewerCounter,
    mount: mounts,
  };
}
