/**
 * Parses REDIS_URL into ioredis-compatible options, handling passwords
 * with special characters (+, =, etc.) that break URL parsing.
 */
export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  db: number;
  password?: string;
} {
  // Match redis://:password@host:port/db
  const match = url.match(/^rediss?:\/\/:?([^@]*)@([^:/?]+):?(\d+)?\/?(\d+)?$/);
  if (!match) {
    // Fallback: no auth, just host:port
    const simple = url.match(/^rediss?:\/\/([^:/?]+):?(\d+)?\/?(\d+)?$/);
    return {
      host: simple?.[1] || 'localhost',
      port: simple?.[2] ? parseInt(simple[2], 10) : 6379,
      db: simple?.[3] ? parseInt(simple[3], 10) : 0,
    };
  }

  return {
    host: match[2],
    port: match[3] ? parseInt(match[3], 10) : 6379,
    db: match[4] ? parseInt(match[4], 10) : 0,
    password: match[1] || undefined,
  };
}
