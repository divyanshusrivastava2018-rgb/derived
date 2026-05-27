import { log } from '../lib/logger.js';

const CANVAS = { width: 1920, height: 1080 };

export class SceneCompositor {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.sceneCache = new Map();
    this.compositionQueue = [];
    this._sharp = null;
    this._sharpFailed = false;
  }

  async getSharp() {
    if (this._sharpFailed) return null;
    if (this._sharp) return this._sharp;
    try {
      const mod = await import('sharp');
      this._sharp = mod.default;
      return this._sharp;
    } catch {
      this._sharpFailed = true;
      log.warn('sharp not installed — scene compositor uses metadata-only previews');
      return null;
    }
  }

  generateCacheKey(config = {}) {
    const sources = Array.isArray(config.sources) ? config.sources : [];
    return Buffer.from(
      JSON.stringify({
        layout: config.layout,
        sources: sources.map((s) => ({ type: s?.type, position: s?.position })),
        timestamp: Math.floor(Date.now() / 1000),
      })
    ).toString('base64');
  }

  async composeScene(sceneConfig = {}) {
    const { layout, sources = [], transitions, watermark, timestamp } = sceneConfig;
    const cacheKey = this.generateCacheKey(sceneConfig);

    if (this.sceneCache.has(cacheKey)) {
      return this.sceneCache.get(cacheKey);
    }

    if (this.redis) {
      try {
        const cached = await this.redis.get(`scene:cache:${cacheKey}`);
        if (cached) {
          const result = this.frameResultFromBase64(cached, {
            layout: layout || 'solo',
            cacheKey,
            sourceCount: sources.length,
            timestamp: timestamp || Date.now(),
          });
          this.sceneCache.set(cacheKey, result);
          return result;
        }
      } catch {
        /* continue */
      }
    }

    const sharp = await this.getSharp();
    if (!sharp) {
      return this.composeMetadataOnly(sceneConfig, cacheKey);
    }

    const src = Array.isArray(sources) ? sources : [];
    let composedFrame;

    switch (layout) {
      case 'solo':
        composedFrame = await this.composeSoloLayout(src, sharp);
        break;
      case 'side':
        composedFrame = await this.composeSideBySide(src, sharp);
        break;
      case 'pip':
        composedFrame = await this.composePictureInPicture(src, sharp);
        break;
      case 'grid':
        composedFrame = await this.composeGridLayout(src, sharp);
        break;
      case 'presenter':
        composedFrame = await this.composePresenterLayout(src, sharp);
        break;
      default:
        composedFrame = await this.composeSoloLayout(src, sharp);
    }

    if (!composedFrame) {
      return this.composeMetadataOnly(sceneConfig, cacheKey);
    }

    if (transitions && transitions.active) {
      composedFrame = await this.applyTransition(composedFrame, transitions, sharp);
    }

    if (watermark) {
      composedFrame = await this.addWatermark(composedFrame, watermark, sharp);
    }

    const result = this.frameResult(composedFrame, {
      layout: layout || 'solo',
      cacheKey,
      sourceCount: src.length,
      timestamp: timestamp || Date.now(),
    });

    this.sceneCache.set(cacheKey, result);
    setTimeout(() => this.sceneCache.delete(cacheKey), 5000);

    if (this.redis && result.imageBase64) {
      try {
        await this.redis.setEx(`scene:cache:${cacheKey}`, 5, result.imageBase64);
      } catch {
        /* ignore */
      }
    }

    return result;
  }

  frameResult(buffer, meta) {
    return {
      layout: meta.layout,
      width: CANVAS.width,
      height: CANVAS.height,
      format: 'png',
      imageBase64: buffer.toString('base64'),
      sourceCount: meta.sourceCount,
      cacheKey: meta.cacheKey,
      composedAt: meta.timestamp || Date.now(),
      preview: null,
    };
  }

  frameResultFromBase64(imageBase64, meta) {
    return {
      layout: meta.layout,
      width: CANVAS.width,
      height: CANVAS.height,
      format: 'png',
      imageBase64,
      sourceCount: meta.sourceCount,
      cacheKey: meta.cacheKey,
      composedAt: meta.timestamp || Date.now(),
      preview: null,
    };
  }

  composeMetadataOnly(sceneConfig, cacheKey) {
    const layout = sceneConfig?.layout || 'grid';
    const sources = Array.isArray(sceneConfig?.sources) ? sceneConfig.sources : [];
    return {
      layout,
      width: CANVAS.width,
      height: CANVAS.height,
      format: 'metadata',
      imageBase64: null,
      sourceCount: sources.length,
      cacheKey,
      composedAt: Date.now(),
      preview: null,
      message: 'Install sharp for server-side scene rendering: npm install sharp',
    };
  }

  async composeSoloLayout(sources, sharp) {
    const mainSource = sources.find((s) => s.type === 'main') || sources[0];
    if (!mainSource) return null;
    return this.processSource(
      mainSource,
      { width: CANVAS.width, height: CANVAS.height, fit: 'cover' },
      sharp
    );
  }

  async composeSideBySide(sources, sharp) {
    const leftSource = sources.find((s) => s.position === 'left') || sources[0];
    const rightSource = sources.find((s) => s.position === 'right') || sources[1];

    const leftFrame = await this.processSource(
      leftSource,
      { width: 960, height: CANVAS.height, fit: 'cover' },
      sharp
    );
    const rightFrame = await this.processSource(
      rightSource,
      { width: 960, height: CANVAS.height, fit: 'cover' },
      sharp
    );

    return sharp({
      create: {
        width: CANVAS.width,
        height: CANVAS.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        { input: leftFrame, left: 0, top: 0 },
        { input: rightFrame, left: 960, top: 0 },
      ])
      .png()
      .toBuffer();
  }

  async composePictureInPicture(sources, sharp) {
    const mainSource = sources.find((s) => s.type === 'main') || sources[0];
    const pipSource = sources.find((s) => s.type === 'pip') || sources[1];

    const mainFrame = await this.processSource(
      mainSource,
      { width: CANVAS.width, height: CANVAS.height, fit: 'cover' },
      sharp
    );
    const pipFrame = await this.processSource(
      pipSource,
      { width: 320, height: 180, fit: 'cover' },
      sharp
    );

    return sharp(mainFrame)
      .composite([{ input: pipFrame, left: 1560, top: 20, blend: 'over' }])
      .png()
      .toBuffer();
  }

  async composeGridLayout(sources, sharp) {
    if (!sources.length) return null;

    const gridSize = Math.ceil(Math.sqrt(sources.length));
    const cellWidth = CANVAS.width / gridSize;
    const cellHeight = CANVAS.height / gridSize;
    const composites = [];

    for (let i = 0; i < sources.length; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      const frame = await this.processSource(
        sources[i],
        { width: cellWidth, height: cellHeight, fit: 'cover' },
        sharp
      );
      composites.push({
        input: frame,
        left: Math.floor(col * cellWidth),
        top: Math.floor(row * cellHeight),
      });
    }

    return sharp({
      create: {
        width: CANVAS.width,
        height: CANVAS.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }

  async composePresenterLayout(sources, sharp) {
    const presenter = sources.find((s) => s.type === 'presenter') || sources[0];
    const content = sources.find((s) => s.type === 'content') || sources[1];

    const presenterFrame = await this.processSource(
      presenter,
      { width: 640, height: 360, fit: 'cover' },
      sharp
    );
    const contentFrame = await this.processSource(
      content,
      { width: CANVAS.width, height: CANVAS.height, fit: 'contain' },
      sharp
    );

    const pipTop = CANVAS.height - 360 - 40;

    return sharp(contentFrame)
      .composite([{ input: presenterFrame, left: 40, top: pipTop, blend: 'over' }])
      .png()
      .toBuffer();
  }

  async processSource(source, dimensions, sharp) {
    const w = Math.round(dimensions.width);
    const h = Math.round(dimensions.height);

    if (!source) {
      return this.defaultPlaceholder(w, h, sharp);
    }

    if (source.type === 'video' && source.stream) {
      return sharp({
        create: {
          width: w,
          height: h,
          channels: 3,
          background: { r: 30, g: 30, b: 40 },
        },
      })
        .png()
        .toBuffer();
    }

    if (source.type === 'image' && source.url) {
      try {
        return await sharp(source.url)
          .resize(w, h, { fit: dimensions.fit })
          .png()
          .toBuffer();
      } catch {
        return this.defaultPlaceholder(w, h, sharp);
      }
    }

    if (source.type === 'text') {
      const text = this.escapeXml(String(source.text || '').slice(0, 500));
      const bg = this.parseBackground(source.backgroundColor, { r: 0, g: 0, b: 0 });
      const fontSize = source.fontSize || 24;
      const color = source.color || '#ffffff';

      return sharp({
        create: {
          width: w,
          height: h,
          channels: 3,
          background: bg,
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
                <text x="50%" y="50%" font-size="${fontSize}"
                  fill="${color}" text-anchor="middle"
                  dominant-baseline="middle" font-family="sans-serif">${text}</text>
              </svg>`
            ),
            blend: 'over',
          },
        ])
        .png()
        .toBuffer();
    }

    return this.defaultPlaceholder(w, h, sharp);
  }

  async defaultPlaceholder(width, height, sharp) {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 50, g: 50, b: 60 },
      },
    })
      .png()
      .toBuffer();
  }

  parseBackground(value, fallback) {
    if (!value) return fallback;
    if (typeof value === 'object' && 'r' in value) return value;
    if (typeof value === 'string' && value.startsWith('#')) {
      const { r, g, b } = this.hexToRgb(value);
      return { r, g, b };
    }
    return fallback;
  }

  hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0,
    };
  }

  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async applyTransition(frame, transition, sharp) {
    const progress = transition.progress ?? 1;

    switch (transition.type) {
      case 'fade': {
        const opacity = 1 - progress;
        return sharp(frame)
          .composite([
            {
              input: Buffer.from(
                `<svg width="${CANVAS.width}" height="${CANVAS.height}" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="black" opacity="${opacity}"/>
                </svg>`
              ),
              blend: 'over',
            },
          ])
          .png()
          .toBuffer();
      }
      case 'wipe':
        return sharp(frame)
          .extract({
            left: 0,
            top: 0,
            width: Math.max(1, Math.floor(CANVAS.width * progress)),
            height: CANVAS.height,
          })
          .png()
          .toBuffer();
      default:
        return frame;
    }
  }

  async addWatermark(frame, watermark, sharp) {
    const w = watermark.width || 200;
    const h = watermark.height || 60;
    const fontSize = watermark.fontSize || 16;
    const color = watermark.color || '#ffffff80';
    const text = this.escapeXml(String(watermark.text || 'Researchium').slice(0, 80));

    let watermarkBuffer;
    if (watermark.imageUrl) {
      try {
        watermarkBuffer = await sharp(watermark.imageUrl)
          .resize(w, h, { fit: 'inside' })
          .png()
          .toBuffer();
      } catch {
        watermarkBuffer = null;
      }
    }

    if (!watermarkBuffer) {
      watermarkBuffer = await sharp(
        Buffer.from(
          `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
            <text x="50%" y="50%" font-size="${fontSize}"
              fill="${color}" text-anchor="middle"
              dominant-baseline="middle" font-weight="bold" font-family="sans-serif">${text}</text>
          </svg>`
        )
      )
        .png()
        .toBuffer();
    }

    const bottomRight = watermark.position === 'bottom-right' || !watermark.position;
    const left = bottomRight ? CANVAS.width - w - 20 : 20;
    const top = bottomRight ? CANVAS.height - h - 20 : 20;

    return sharp(frame)
      .composite([{ input: watermarkBuffer, left, top, blend: 'over' }])
      .png()
      .toBuffer();
  }
}
