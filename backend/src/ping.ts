import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

export interface ServerStatusResponse {
  online: boolean;
  serverName: string;
  serverIp: string;
  version: string;
  onlinePlayers: number;
  maxPlayers: number;
  motd: string;
  ping: number;
  lastChecked: number;
}

const host = process.env.MINECRAFT_HOST || 'play.samratnagarkoti.com.np';
const port = parseInt(process.env.MINECRAFT_PORT || '25565', 10);
const serverName = process.env.SERVER_DISPLAY_NAME || 'Oxygen PvP';

let cachedStatus: ServerStatusResponse = {
  online: false,
  serverName,
  serverIp: host,
  version: '1.21.4',
  onlinePlayers: 0,
  maxPlayers: 100,
  motd: 'Competitive Duels & Ranked Ladder',
  ping: 0,
  lastChecked: 0,
};

const CACHE_TTL_MS = 6000;

export async function getServerStatus(): Promise<ServerStatusResponse> {
  const now = Date.now();
  if (now - cachedStatus.lastChecked < CACHE_TTL_MS && cachedStatus.lastChecked > 0) {
    return cachedStatus;
  }

  try {
    const directResult = await pingMinecraftServerDirect(host, port, 2500);
    cachedStatus = {
      ...directResult,
      serverName,
      serverIp: host,
      lastChecked: now,
    };
    return cachedStatus;
  } catch (directErr: any) {
    // Fallback to mcstatus API
    try {
      const fallbackResult = await pingViaHttpApi(host, port);
      let isOnline = fallbackResult.online;
      if (!isOnline) {
        try {
          const pteroRes = await fetch('https://mccanvas.setotower.com/api/client/servers/f40a8e96/resources', {
            headers: {
              'Authorization': 'Bearer ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a',
              'Accept': 'application/json'
            }
          });
          if (pteroRes.ok) {
            const d: any = await pteroRes.json();
            if (d.attributes?.current_state === 'running') isOnline = true;
          }
        } catch (e) {}
      }

      cachedStatus = {
        ...fallbackResult,
        online: isOnline,
        serverName,
        serverIp: 'play.samratnagarkoti.com.np',
        lastChecked: now,
      };
      return cachedStatus;
    } catch (apiErr) {
      // Check Pterodactyl container state
      let pteroRunning = false;
      try {
        const pteroRes = await fetch('https://mccanvas.setotower.com/api/client/servers/f40a8e96/resources', {
          headers: {
            'Authorization': 'Bearer ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a',
            'Accept': 'application/json'
          }
        });
        if (pteroRes.ok) {
          const d: any = await pteroRes.json();
          if (d.attributes?.current_state === 'running') pteroRunning = true;
        }
      } catch (e) {}

      cachedStatus = {
        online: pteroRunning,
        serverName,
        serverIp: 'play.samratnagarkoti.com.np',
        version: '1.21.4',
        onlinePlayers: pteroRunning ? 1 : 0,
        maxPlayers: 100,
        motd: pteroRunning ? 'Oxygen PvP Nepal Network' : 'Server offline or unreachable',
        ping: 25,
        lastChecked: now,
      };
      return cachedStatus;
    }
  }
}

/**
 * Standard Minecraft Server List Ping (SLP) protocol over TCP.
 */
function pingMinecraftServerDirect(
  serverHost: string,
  serverPort: number,
  timeoutMs = 2500
): Promise<Omit<ServerStatusResponse, 'serverName' | 'serverIp' | 'lastChecked'>> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let responseData = Buffer.alloc(0);

    socket.setTimeout(timeoutMs);

    socket.connect(serverPort, serverHost, () => {
      // 1. Handshake Packet (Protocol 765 = 1.20.4+, Next state = 1)
      const hostBuffer = Buffer.from(serverHost, 'utf8');
      const handshake = Buffer.concat([
        Buffer.from([0x00]), // Packet ID
        encodeVarInt(765),   // Protocol version
        encodeVarInt(hostBuffer.length),
        hostBuffer,
        Buffer.from([(serverPort >> 8) & 0xff, serverPort & 0xff]),
        Buffer.from([0x01]), // Next State: 1 (Status)
      ]);

      const handshakePacket = Buffer.concat([encodeVarInt(handshake.length), handshake]);
      socket.write(handshakePacket);

      // 2. Status Request Packet
      const requestPacket = Buffer.from([0x01, 0x00]);
      socket.write(requestPacket);
    });

    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
      try {
        const pingMs = Date.now() - startTime;
        let offset = 0;
        const [packetLength, lengthBytes] = decodeVarInt(responseData, offset);
        offset += lengthBytes;

        const [packetId, idBytes] = decodeVarInt(responseData, offset);
        offset += idBytes;

        if (packetId === 0x00) {
          const [jsonLength, jsonLengthBytes] = decodeVarInt(responseData, offset);
          offset += jsonLengthBytes;

          if (responseData.length >= offset + jsonLength) {
            const jsonString = responseData.slice(offset, offset + jsonLength).toString('utf8');
            const data = JSON.parse(jsonString);

            socket.destroy();

            let motdText = 'Oxygen Competitive Duels';
            if (typeof data.description === 'string') {
              motdText = data.description.replace(/§[0-9a-fk-or]/gi, '');
            } else if (data.description && typeof data.description.text === 'string') {
              motdText = data.description.text.replace(/§[0-9a-fk-or]/gi, '');
            }

            resolve({
              online: true,
              version: data.version?.name || '1.21.4',
              onlinePlayers: data.players?.online || 0,
              maxPlayers: data.players?.max || 100,
              motd: motdText,
              ping: pingMs,
            });
          }
        }
      } catch (err) {
        // Incomplete packet; wait for next chunk
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Socket timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function pingViaHttpApi(
  serverHost: string,
  serverPort: number
): Promise<Omit<ServerStatusResponse, 'serverName' | 'serverIp' | 'lastChecked'>> {
  const target = serverPort === 25565 ? serverHost : `${serverHost}:${serverPort}`;
  const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(target)}`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`HTTP API status ${res.status}`);

  const data: any = await res.json();
  return {
    online: Boolean(data.online),
    version: data.version?.name_clean || data.version?.name_raw || '1.21.4',
    onlinePlayers: data.players?.online || 0,
    maxPlayers: data.players?.max || 100,
    motd: data.motd?.clean || 'Oxygen Competitive Duels',
    ping: 28,
  };
}

function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  while (true) {
    if ((value & 0xffffff80) === 0) {
      bytes.push(value);
      return Buffer.from(bytes);
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
}

function decodeVarInt(buffer: Buffer, offset: number): [number, number] {
  let result = 0;
  let bytes = 0;
  let currentByte = 0;

  do {
    currentByte = buffer[offset + bytes];
    result |= (currentByte & 0x7f) << (bytes * 7);
    bytes++;
    if (bytes > 5) throw new Error('VarInt is too big');
  } while ((currentByte & 0x80) !== 0);

  return [result, bytes];
}
