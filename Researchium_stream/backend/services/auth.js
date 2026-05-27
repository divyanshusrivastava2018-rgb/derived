import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

const ISSUER = 'researchium-stream';
const SESSION_AUD = 'researchium-session';
const SIGNALING_AUD = 'researchium-signaling';

export class AuthService {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.secret = config.jwtSecret;
    this.sessionExpiry = Number(process.env.SESSION_EXPIRY_SEC) || 7 * 24 * 60 * 60;
    this.sessions = new Map();
    this.guestTokens = new Map();
    this.userPlans = new Map();
  }

  decodeToken(token) {
    const attempts = [
      { issuer: ISSUER, audience: SESSION_AUD },
      { issuer: ISSUER, audience: SIGNALING_AUD },
      { issuer: ISSUER },
      {},
    ];
    let lastError;
    for (const options of attempts) {
      try {
        return jwt.verify(token, this.secret, options);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Invalid token');
  }

  async authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = this.decodeToken(token);
      const userId = decoded.userId || decoded.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const sessionValid = await this.isSessionValid(userId, token);
      if (!sessionValid) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      req.userId = userId;
      req.user = decoded;
      req.userEmail = decoded.email;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  /**
   * If a server-side session exists, it must match the bearer token.
   * Core API JWTs without a stored session still pass.
   */
  async isSessionValid(userId, token) {
    let stored = null;

    if (this.redis) {
      try {
        stored = await this.redis.get(`session:${userId}`);
      } catch {
        stored = null;
      }
    } else {
      stored = this.sessions.get(userId) || null;
    }

    if (!stored) return true;
    return stored === token;
  }

  async generateToken(userId, email) {
    const token = jwt.sign(
      { userId, email, sub: userId, iat: Math.floor(Date.now() / 1000) },
      this.secret,
      {
        expiresIn: this.sessionExpiry,
        issuer: ISSUER,
        audience: SESSION_AUD,
      }
    );

    if (this.redis) {
      await this.redis.setEx(`session:${userId}`, this.sessionExpiry, token);
    } else {
      this.sessions.set(userId, token);
    }

    return token;
  }

  verifySocketToken(token) {
    const payload = this.decodeToken(token);
    if (payload.type === 'guest' || payload.role === 'viewer') {
      void this.validateGuestToken(token, payload.roomId).catch(() => {});
    }
    return payload;
  }

  verifySessionToken(token) {
    return jwt.verify(token, this.secret, {
      issuer: ISSUER,
      audience: SESSION_AUD,
    });
  }

  async validateGuestToken(token, roomId) {
    let storedRoomId = null;

    if (this.redis) {
      storedRoomId = await this.redis.get(`guest:${token}`);
    } else {
      const entry = this.guestTokens.get(token);
      if (entry && entry.expires > Date.now()) storedRoomId = entry.roomId;
    }

    if (storedRoomId) return storedRoomId === roomId;

    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: ISSUER,
        audience: SIGNALING_AUD,
      });
      return !roomId || decoded.roomId === roomId;
    } catch {
      return false;
    }
  }

  async generateGuestToken(roomId, email = '') {
    const token = jwt.sign(
      {
        sub: crypto.randomUUID(),
        roomId,
        email,
        type: 'guest',
        role: 'viewer',
        iat: Math.floor(Date.now() / 1000),
      },
      this.secret,
      { expiresIn: '1h', issuer: ISSUER, audience: SIGNALING_AUD }
    );

    if (this.redis) {
      await this.redis.setEx(`guest:${token}`, 3600, roomId);
    } else {
      this.guestTokens.set(token, { roomId, expires: Date.now() + 3600000 });
    }

    return token;
  }

  async setUserPlan(userId, plan) {
    if (this.redis) {
      await this.redis.set(`user:${userId}:plan`, plan);
    }
    this.userPlans.set(userId, plan);
  }

  async moderateMessage(message) {
    const text = String(message || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 2000);
    if (!text.trim()) {
      return { approved: false, message: '', sentiment: 'neutral' };
    }

    const toxicWords = ['hate', 'violence', 'abuse', 'spam', 'viagra'];
    let moderatedMessage = text;
    let approved = true;
    let sentiment = 'neutral';

    for (const word of toxicWords) {
      if (text.toLowerCase().includes(word)) {
        approved = false;
        moderatedMessage = moderatedMessage.replace(new RegExp(word, 'gi'), '***');
      }
    }

    const positiveWords = ['good', 'great', 'awesome', 'love', 'amazing'];
    const negativeWords = ['bad', 'terrible', 'hate', 'awful'];
    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;

    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';
    else if (text.includes('?')) sentiment = 'curious';

    return { approved, message: moderatedMessage, sentiment };
  }

  async hasRecordingPermission(userId) {
    if (!userId) return false;

    let userPlan = null;
    if (this.redis) {
      try {
        userPlan = await this.redis.get(`user:${userId}:plan`);
      } catch {
        userPlan = null;
      }
    }
    userPlan = userPlan || this.userPlans.get(userId);

    if (userPlan === 'pro' || userPlan === 'enterprise') return true;

    // Dev / core-API users without plan metadata
    if (!userPlan && !this.redis) return true;

    return false;
  }
}
