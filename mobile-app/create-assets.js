const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // Create IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // Create raw image data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  const idat = createChunk('IDAT', compressed);

  // Create IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return crc ^ 0xFFFFFFFF;
}

// Create assets directory
const assetsDir = path.join(__dirname, 'assets', 'images');
fs.mkdirSync(assetsDir, { recursive: true });

// Colors
const accent = [233, 69, 96];   // #e94560
const brand = [26, 26, 46];    // #1a1a2e

// Create icon.png (1024x1024)
console.log('Creating icon.png...');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPNG(1024, 1024, ...accent));

// Create adaptive-icon.png (1024x1024)
console.log('Creating adaptive-icon.png...');
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createPNG(1024, 1024, ...accent));

// Create splash.png (1284x2778)
console.log('Creating splash.png...');
fs.writeFileSync(path.join(assetsDir, 'splash.png'), createPNG(1284, 2778, ...brand));

// Create favicon.png (48x48)
console.log('Creating favicon.png...');
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), createPNG(48, 48, ...accent));

console.log('Done!');
