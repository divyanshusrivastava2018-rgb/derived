import { PLATFORMS, isPlatformConfigured, platformConfig } from './config.js';
import { multistreamRepo } from './repository.js';
import { signOAuthState, verifyOAuthState } from './oauth-state.js';
import { getAdapter } from './platforms/index.js';
import { withRetry } from './lib/retry.js';
import { streamSessionManager } from '../stream-sessions/manager.js';
import { getFreshConnectionSecrets } from './token-refresher.js';
import { createIngestSession } from '../rtmp/ingest.js';
import { startDistribution } from '../rtmp/distributor.js';

export class MultistreamManager {
  listPlatforms(userId) {
    return PLATFORMS.map((id) => ({
      id,
      label: platformConfig[id].label,
      configured: isPlatformConfigured(id),
      rtmpIngest: platformConfig[id].rtmpIngest,
    }));
  }

  async listConnections(userId) {
    const connections = await multistreamRepo.listConnections(userId);
    const byPlatform = Object.fromEntries(connections.map((c) => [c.platform, c]));
    return PLATFORMS.map((platform) => ({
      platform,
      label: platformConfig[platform].label,
      configured: isPlatformConfigured(platform),
      connected: Boolean(byPlatform[platform]),
      accountName: byPlatform[platform]?.accountName || null,
      status: byPlatform[platform]?.status || 'disconnected',
    }));
  }

  startOAuth(platform, userId) {
    if (!PLATFORMS.includes(platform)) throw new Error('invalid_platform');
    if (!isPlatformConfigured(platform)) {
      throw new Error(`${platform}_oauth_not_configured`);
    }
    const state = signOAuthState({ userId, platform });
    const url = getAdapter(platform).getAuthUrl(state);
    return { url, state };
  }

  async completeOAuth(platform, code, state) {
    const decoded = verifyOAuthState(state);
    if (decoded.platform !== platform) throw new Error('state_mismatch');

    const tokens = await getAdapter(platform).exchangeCode(code);
    const connection = await multistreamRepo.saveConnection(decoded.userId, platform, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      streamKey: tokens.streamKey,
      expiresAt: tokens.expiresAt,
    }, {
      accountId: tokens.accountId,
      accountName: tokens.accountName,
      metadata: tokens.metadata,
    });

    return { connection, userId: decoded.userId };
  }

  async disconnect(userId, platform) {
    await multistreamRepo.disconnect(userId, platform);
  }

  async goLiveAll(userId, { title, description, roomSlug, platforms, privacyStatus }) {
    const requested = platforms?.length ? platforms : PLATFORMS;
    const broadcast = await multistreamRepo.createBroadcast(userId, {
      roomSlug,
      title: title || 'Researchium Live',
      description,
    });

    const results = await Promise.allSettled(
      requested.map((platform) =>
        withRetry(() => this.goLivePlatform(userId, platform, { title, description, privacyStatus }), {
          maxAttempts: 2,
        })
      )
    );

    const targets = [];
    let liveCount = 0;

    for (let i = 0; i < requested.length; i++) {
      const platform = requested[i];
      const result = results[i];
      if (result.status === 'fulfilled') {
        liveCount++;
        const t = await multistreamRepo.addTarget(broadcast.id, {
          platform,
          external_broadcast_id: result.value.externalBroadcastId,
          rtmp_url: result.value.rtmpUrl,
          playback_url: result.value.playbackUrl,
          status: 'live',
          metadata: { streamKeyHint: maskKey(result.value.streamKey) },
        });
        targets.push({ platform, ok: true, ...result.value, targetId: t.id });
      } else {
        await multistreamRepo.addTarget(broadcast.id, {
          platform,
          status: 'failed',
          error_message: result.reason?.message || 'unknown_error',
        });
        targets.push({ platform, ok: false, error: result.reason?.message });
      }
    }

    const status =
      liveCount === requested.length ? 'live' : liveCount > 0 ? 'partial' : 'failed';
    await multistreamRepo.finalizeBroadcast(broadcast.id, status);

    const unifiedRtmp = buildUnifiedIngest(targets.filter((t) => t.ok));

    const session = await streamSessionManager.start(userId, {
      roomSlug,
      broadcastId: broadcast.id,
      title: title || 'Researchium Live',
      metadata: { multistreamStatus: status, targetCount: targets.length },
    });

    const localIngest =
      process.env.RTMP_INGEST_ENABLED !== '0' && roomSlug
        ? createIngestSession({
            userId,
            roomSlug,
            title: title || 'Researchium Live',
          })
        : null;

    return {
      broadcastId: broadcast.id,
      sessionId: session.id,
      status,
      title,
      roomSlug,
      targets,
      ingest: {
        ...unifiedRtmp,
        localRtmp: localIngest,
        workflow:
          'Publish once to local RTMP (OBS → local ingest URL), then POST /api/rtmp/distribute with streamKey.',
      },
    };
  }

  async startRtmpDistribution(userId, { streamKey, broadcastId, platforms }) {
    const ingest = (await import('../rtmp/ingest.js')).getIngestSession(streamKey);
    if (!ingest || ingest.userId !== userId) throw new Error('ingest_not_found');

    const live = await this.goLiveAll(userId, {
      title: ingest.title,
      roomSlug: ingest.roomSlug,
      platforms,
    });

    const distTargets = live.targets
      .filter((t) => t.ok && t.rtmpUrl)
      .map((t) => ({
        platform: t.platform,
        rtmpUrl: t.rtmpUrl,
        streamKey: t.streamKey,
      }));

    const distribution = startDistribution(streamKey, distTargets, { userId });
    return { broadcast: live, distribution };
  }

  async goLivePlatform(userId, platform, opts) {
    const secrets = await getFreshConnectionSecrets(userId, platform);
    if (!secrets) throw new Error(`${platform}_not_connected`);

    const adapter = getAdapter(platform);
    const live = await adapter.createLive({
      accessToken: secrets.accessToken,
      refreshToken: secrets.refreshToken,
      streamKey: secrets.streamKey,
      accountId: secrets.connection.accountId,
      title: opts.title,
      description: opts.description,
      privacyStatus: opts.privacyStatus,
    });

    if (live.streamKey && live.streamKey !== secrets.streamKey) {
      await multistreamRepo.saveConnection(
        userId,
        platform,
        {
          accessToken: secrets.accessToken,
          refreshToken: secrets.refreshToken,
          streamKey: live.streamKey,
          expiresAt: secrets.connection.tokenExpiresAt,
        },
        {
          accountId: secrets.connection.accountId,
          accountName: secrets.connection.accountName,
          metadata: secrets.connection.metadata,
        }
      );
    }

    return { platform, ...live };
  }

  async endBroadcast(userId, broadcastId) {
    const broadcast = await multistreamRepo.getBroadcast(broadcastId);
    if (!broadcast || broadcast.user_id !== userId) throw new Error('broadcast_not_found');

    const endings = await Promise.allSettled(
      (broadcast.targets || [])
        .filter((t) => t.status === 'live' && t.external_broadcast_id)
        .map(async (t) => {
          const secrets = await getFreshConnectionSecrets(userId, t.platform);
          if (!secrets) return;
          const adapter = getAdapter(t.platform);
          if (adapter.endLive) {
            await adapter.endLive({
              accessToken: secrets.accessToken,
              refreshToken: secrets.refreshToken,
              externalBroadcastId: t.external_broadcast_id,
            });
          }
        })
    );

    await multistreamRepo.finalizeBroadcast(broadcastId, 'ended');
    await streamSessionManager.endByBroadcast(userId, broadcastId);
    return { broadcastId, ended: endings.length };
  }
}

function maskKey(key) {
  if (!key || key.length < 8) return key ? '••••' : null;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function buildUnifiedIngest(targets) {
  const primary = targets.find((t) => t.rtmpUrl && t.streamKey) || targets.find((t) => t.rtmpUrl);
  if (!primary) return { note: 'Use each platform RTMP target below in a multistream encoder (OBS custom outputs).' };
  return {
    primaryPlatform: primary.platform,
    rtmpUrl: primary.rtmpUrl,
    streamKeyHint: maskKey(primary.streamKey),
    allTargets: targets.map((t) => ({
      platform: t.platform,
      rtmpUrl: t.rtmpUrl,
      streamKeyHint: maskKey(t.streamKey),
      playbackUrl: t.playbackUrl,
    })),
  };
}
