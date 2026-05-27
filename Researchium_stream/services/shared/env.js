const isProd = process.env.NODE_ENV === 'production';

export function requireEnv(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function getHost() {
  return process.env.HOST || '127.0.0.1';
}

export function isProduction() {
  return isProd;
}
