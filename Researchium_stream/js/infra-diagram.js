/**
 * Interactive deployment diagram canvas.
 */
(function (global) {
  function InfraDiagram(canvas, nodes, edges, onSelect) {
    this.canvas = canvas;
    this.nodes = nodes;
    this.edges = edges;
    this.onSelect = onSelect;
    this.activeId = nodes[0]?.id;
    this.t = 0;
    this.packets = [];
    this._resize = this._resize.bind(this);
    this._click = this._click.bind(this);
  }

  InfraDiagram.prototype._resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
    this._layout();
  };

  InfraDiagram.prototype._layout = function () {
    this.pos = {};
    this.nodes.forEach((n) => {
      this.pos[n.id] = { x: n.x * this.W, y: n.y * this.H, n };
    });
  };

  InfraDiagram.prototype._boxAt = function (id) {
    const p = this.pos[id];
    const w = id === 'react' ? 168 : 152;
    const h = 44;
    return { x: p.x - w / 2, y: p.y - h / 2, w, h, cx: p.x, cy: p.y };
  };

  InfraDiagram.prototype._click = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const n of this.nodes) {
      const b = this._boxAt(n.id);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.activeId = n.id;
        if (this.onSelect) this.onSelect(n);
        return;
      }
    }
  };

  InfraDiagram.prototype._drawEdge = function (from, to, label) {
    const ctx = this.ctx;
    const a = this._boxAt(from);
    const b = this._boxAt(to);
    let x1 = a.cx, y1 = a.cy + a.h / 2;
    let x2 = b.cx, y2 = b.cy - b.h / 2;
    if (from === 'react' && to === 'api') {
      y1 = a.cy + 6;
      x1 = a.cx + 20;
      x2 = b.cx - 20;
      y2 = b.cy - b.h / 2;
    } else if (from === 'react' && to === 'signaling') {
      y1 = a.cy + 6;
      x1 = a.cx - 20;
      x2 = b.cx + 20;
      y2 = b.cy - b.h / 2;
    } else if (from === 'api' && to === 'postgres') {
      x1 = a.cx;
      y1 = a.cy + a.h / 2;
      x2 = b.cx;
      y2 = b.cy - b.h / 2;
    }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.font = '400 8px "DM Mono"';
      ctx.fillStyle = 'rgba(154, 163, 184, 0.95)';
      ctx.textAlign = 'center';
      ctx.fillText(label, mx, my - 4);
    }
  };

  InfraDiagram.prototype._drawNode = function (n) {
    const ctx = this.ctx;
    const b = this._boxAt(n.id);
    const active = n.id === this.activeId;

    ctx.fillStyle = active ? 'rgba(139, 92, 246, 0.22)' : 'rgba(28, 34, 51, 0.95)';
    ctx.strokeStyle = active ? n.color : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = active ? 2 : 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '600 11px "Plus Jakarta Sans"';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, b.cx, b.cy - 2);
    ctx.fillStyle = 'rgba(154, 163, 184, 0.95)';
    ctx.font = '400 9px "DM Mono"';
    ctx.fillText(n.sub, b.cx, b.cy + 12);
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  InfraDiagram.prototype._tickPackets = function () {
    if (Math.random() < 0.05) {
      const edge = this.edges[Math.floor(Math.random() * this.edges.length)];
      this.packets.push({ edge, u: 0, speed: 0.008 + Math.random() * 0.006 });
    }
    this.packets = this.packets.filter((p) => {
      p.u += p.speed;
      if (p.u >= 1) return false;
      const a = this._boxAt(p.edge.from);
      const b = this._boxAt(p.edge.to);
      let x1 = a.cx, y1 = a.cy + a.h / 2;
      let x2 = b.cx, y2 = b.cy - b.h / 2;
      if (p.edge.from === 'react') {
        y1 = a.cy + 8;
        x1 = p.edge.to === 'api' ? a.cx + 30 : a.cx - 30;
        x2 = p.edge.to === 'api' ? b.cx - 30 : b.cx + 30;
        y2 = b.cy - b.h / 2;
      }
      const px = x1 + (x2 - x1) * p.u;
      const py = y1 + (y2 - y1) * p.u;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
      this.ctx.fill();
      return true;
    });
  };

  InfraDiagram.prototype._frame = function () {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, this.W, this.H);

    this.edges.forEach((e) => this._drawEdge(e.from, e.to, e.label));
    this.nodes.forEach((n) => this._drawNode(n));
    this._tickPackets();

    this.t++;
    this._raf = requestAnimationFrame(() => this._frame());
  };

  InfraDiagram.prototype.start = function () {
    this._resize();
    window.addEventListener('resize', this._resize);
    this.canvas.addEventListener('click', this._click);
    this._frame();
  };

  InfraDiagram.prototype.stop = function () {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('click', this._click);
  };

  global.Researchium = global.Researchium || {};
  global.Researchium.InfraDiagram = InfraDiagram;
})(typeof window !== 'undefined' ? window : globalThis);
