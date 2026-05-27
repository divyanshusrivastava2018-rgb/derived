export async function withRetry(fn, { maxAttempts = 3, shouldRetry = () => true } = {}) {
  let last;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      if (i >= maxAttempts || !shouldRetry(e, i)) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
    }
  }
  throw last;
}
