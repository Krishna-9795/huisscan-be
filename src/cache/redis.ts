import net from "node:net";
import tls from "node:tls";

export type RedisCommandPart = string | number;

type RedisReply = string | number | null | RedisReply[];

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

function commandTimeoutMs(): number {
  const parsed = Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 5_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

function redisUrl(): URL {
  return new URL(process.env.KADASTER_REDIS_URL || process.env.REDIS_URL || DEFAULT_REDIS_URL);
}

function encodeCommand(parts: RedisCommandPart[]): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${parts.length}\r\n`, "utf8")];

  for (const part of parts) {
    const value = Buffer.from(String(part), "utf8");
    chunks.push(Buffer.from(`$${value.length}\r\n`, "utf8"), value, Buffer.from("\r\n", "utf8"));
  }

  return Buffer.concat(chunks);
}

class RespParser {
  private offset = 0;

  constructor(private buffer: Buffer) {}

  get done(): boolean {
    return this.offset >= this.buffer.length;
  }

  parse(): RedisReply {
    const prefix = this.readByte();
    if (prefix === 43) return this.readLine();
    if (prefix === 45) throw new Error(`Redis error: ${this.readLine()}`);
    if (prefix === 58) return Number(this.readLine());
    if (prefix === 36) return this.readBulkString();
    if (prefix === 42) return this.readArray();
    throw new Error(`Unsupported Redis RESP prefix: ${String.fromCharCode(prefix)}`);
  }

  private readByte(): number {
    if (this.offset >= this.buffer.length) {
      throw new Error("Unexpected end of Redis response");
    }

    return this.buffer[this.offset++];
  }

  private readLine(): string {
    const end = this.buffer.indexOf("\r\n", this.offset, "utf8");
    if (end === -1) {
      throw new Error("Incomplete Redis response line");
    }

    const line = this.buffer.toString("utf8", this.offset, end);
    this.offset = end + 2;
    return line;
  }

  private readBulkString(): string | null {
    const length = Number(this.readLine());
    if (length === -1) return null;
    if (!Number.isFinite(length) || length < 0) {
      throw new Error("Invalid Redis bulk string length");
    }

    const end = this.offset + length;
    if (end + 2 > this.buffer.length) {
      throw new Error("Incomplete Redis bulk string");
    }

    const value = this.buffer.toString("utf8", this.offset, end);
    this.offset = end + 2;
    return value;
  }

  private readArray(): RedisReply[] | null {
    const length = Number(this.readLine());
    if (length === -1) return null;
    if (!Number.isFinite(length) || length < 0) {
      throw new Error("Invalid Redis array length");
    }

    const items: RedisReply[] = [];
    for (let index = 0; index < length; index += 1) {
      items.push(this.parse());
    }

    return items;
  }
}

function socketFor(url: URL): net.Socket | tls.TLSSocket {
  const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379));
  const host = url.hostname || "127.0.0.1";

  if (url.protocol === "rediss:") {
    return tls.connect({ host, port, servername: host });
  }

  return net.createConnection({ host, port });
}

function setupCommands(url: URL): RedisCommandPart[][] {
  const commands: RedisCommandPart[][] = [];
  const username = decodeURIComponent(url.username || "");
  const password = decodeURIComponent(url.password || "");
  const db = url.pathname.replace(/^\//, "");

  if (password && username) commands.push(["AUTH", username, password]);
  else if (password) commands.push(["AUTH", password]);

  if (db) commands.push(["SELECT", db]);
  return commands;
}

export async function redisCommand(parts: RedisCommandPart[]): Promise<RedisReply> {
  const url = redisUrl();
  const commands = [...setupCommands(url), parts];

  return new Promise((resolve, reject) => {
    const socket = socketFor(url);
    const chunks: Buffer[] = [];
    let settled = false;
    let commandWritten = false;

    const writeCommand = () => {
      if (commandWritten) return;
      commandWritten = true;
      socket.write(Buffer.concat(commands.map(encodeCommand)));
    };

    const finish = (error: Error | null, value?: RedisReply) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error);
      else resolve(value ?? null);
    };

    const timeout = setTimeout(() => {
      finish(new Error(`Redis command timed out after ${commandTimeoutMs()}ms`));
    }, commandTimeoutMs());

    if (url.protocol === "rediss:") {
      socket.on("secureConnect", writeCommand);
    } else {
      socket.on("connect", writeCommand);
    }

    socket.on("data", (chunk) => {
      chunks.push(chunk);
      try {
        const parser = new RespParser(Buffer.concat(chunks));
        let reply: RedisReply = null;
        for (let index = 0; index < commands.length; index += 1) {
          reply = parser.parse();
        }

        if (!parser.done) return;
        finish(null, reply);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("Incomplete") || message.startsWith("Unexpected end")) return;
        finish(error instanceof Error ? error : new Error(message));
      }
    });

    socket.on("error", (error) => finish(error));
    socket.on("end", () => {
      if (!settled) {
        finish(new Error("Redis connection closed before a full response was received"));
      }
    });
  });
}

export function redisCacheKey(type: "dashboard" | "source" | "lock", key: string): string {
  const prefix = process.env.KADASTER_CACHE_PREFIX || "huisscan:kadaster-dashboard";
  return `${prefix}:${type}:${key}`;
}

export async function redisGetJson<T>(type: "dashboard" | "source", key: string): Promise<T | null> {
  const reply = await redisCommand(["GET", redisCacheKey(type, key)]);
  if (reply === null) return null;
  if (typeof reply !== "string") throw new Error("Unexpected Redis GET response type");
  return JSON.parse(reply) as T;
}

export async function redisSetJson(
  type: "dashboard" | "source",
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await redisCommand(["SET", redisCacheKey(type, key), JSON.stringify(value), "EX", ttlSeconds]);
}

export async function redisScanKeys(match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const reply = await redisCommand(["SCAN", cursor, "MATCH", match, "COUNT", 100]);
    if (!Array.isArray(reply) || reply.length !== 2 || typeof reply[0] !== "string") {
      throw new Error("Unexpected Redis SCAN response type");
    }

    cursor = reply[0];
    const batch = reply[1];
    if (!Array.isArray(batch)) {
      throw new Error("Unexpected Redis SCAN key batch type");
    }

    for (const item of batch) {
      if (typeof item === "string") {
        keys.push(item);
      }
    }
  } while (cursor !== "0");

  return keys;
}
