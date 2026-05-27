/**
 * Animated WebRTC → SFU pipeline (canvas + packet pulses).
 */
(function (global) {
  const NODES = [
    { key: 'browser', x: 0.08, label: 'Browser' },
    { key: 'signaling', x: 0.28, label: 'Signaling' },
    { key: 'peer', x: 0.48, label: 'WebRTC' },
    { key: 'sfu', x: 0.68, label: 'SFU' },
    { key: 'participants', x: 0.88, label: 'Participants' },
  ];

  function SignalingClient({ url, roomId }) {
    this.url = url;
    this.roomId = roomId;
    this.handlers = {};
  }
  SignalingClient.prototype.on = function (event, fn) {
    this.handlers[event] = fn;
    return this;
  };
  SignalingClient.prototype.connect = function () {
    return Promise.resolve({ roomId: this.roomId, state: 'connected' });
  };
  SignalingClient.prototype.sendOffer = function (sdp) {
    if (this.handlers.message) this.handlers.message({ type: 'offer', sdp });
    return Promise.resolve({ type: 'answer', sdp: { type: 'answer' } });
  };

  function PipelineCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.packets = [];
    this._raf = null;
    this._resize = this._resize.bind(this);
  }

  PipelineCanvas.prototype._resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
  };

  PipelineCanvas.prototype._spawnPacket = function () {
    for (let i = 0; i < NODES.length - 1; i++) {
      this.packets.push({
        seg: i,
        u: 0,
        speed: 0.012 + Math.random() * 0.008,
        hue: 190 + i * 18,
      });
    }
  };

  PipelineCanvas.prototype._drawNode = function (nx, ny, label, lit) {
    const ctx = this.ctx;
    const r = 22;
    ctx.beginPath();
    ctx.arc(nx, ny, r, 0, Math.PI * 2);
    ctx.fillStyle = lit ? 'rgba(124,92,252,.35)' : 'rgba(16,16,42,.9)';
    ctx.fill();
    ctx.strokeStyle = lit ? '#8b5cf6' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = lit ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = lit ? '#fff' : '#dde0f5';
    ctx.font = '500 10px "DM Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(label, nx, ny + r + 14);
  };

  PipelineCanvas.prototype._frame = function () {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const cy = H * 0.42;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, W, H);

    const positions = NODES.map((n) => ({ x: n.x * W, y: cy, label: n.label }));

    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      const grad = ctx.createLinearGradient(a.x, cy, b.x, cy);
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.1)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x + 24, cy);
      ctx.lineTo(b.x - 24, cy);
      ctx.stroke();
    }

    if (Math.random() < 0.04) this._spawnPacket();

    this.packets = this.packets.filter((p) => {
      p.u += p.speed;
      if (p.u >= 1) return false;
      const a = positions[p.seg];
      const b = positions[p.seg + 1];
      const px = a.x + 24 + (b.x - a.x - 48) * p.u;
      const py = cy + Math.sin(p.u * Math.PI) * -8;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${0.9 - p.u * 0.3})`;
      ctx.fill();
      return true;
    });

    const pulse = (Math.sin(this.t * 0.05) + 1) / 2;
    const litNode = Math.floor(this.t / 90) % NODES.length;
    positions.forEach((p, i) => {
      this._drawNode(p.x, p.y, p.label, i === litNode || i === litNode - 1);
    });

    ctx.fillStyle = `rgba(196, 181, 253, ${0.4 + pulse * 0.25})`;
    ctx.font = '400 9px "DM Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('media ↑  signaling ⇄  selective forward ↓', 12, H - 14);

    this.t++;
    this._raf = requestAnimationFrame(() => this._frame());
  };

  PipelineCanvas.prototype.start = function () {
    this._resize();
    window.addEventListener('resize', this._resize);
    this._frame();
  };

  PipelineCanvas.prototype.stop = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
  };

  global.Researchium = global.Researchium || {};
  global.Researchium.WebRTC = { SignalingClient, PipelineCanvas, NODES };
})(typeof window !== 'undefined' ? window : globalThis);
