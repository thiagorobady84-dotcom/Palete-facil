import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(2, 9); // Color type 2 (Truecolor RGB)
  ihdr.writeUInt8(0, 10); // Compression method
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace method

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Simple CRC32 implementation
  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  // Raw image data with row filters
  // We draw a nice emerald gradient background with an amber/wood pallet symbol in the center
  const rowBytes = 1 + width * 3;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    rawData[rowStart] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;

      // Distance from center for circle / box
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;

      // Center box shape
      const inBox = Math.abs(dx) < width * 0.28 && Math.abs(dy + height * 0.08) < height * 0.22;
      const inPallet = Math.abs(dx) < width * 0.32 && dy > height * 0.16 && dy < height * 0.32;

      if (inBox) {
        // Bright emerald/green box
        rawData[px] = 74;   // R
        rawData[px + 1] = 222; // G
        rawData[px + 2] = 128; // B
      } else if (inPallet) {
        // Amber wood pallet
        rawData[px] = 245;  // R
        rawData[px + 1] = 158; // G
        rawData[px + 2] = 11;  // B
      } else {
        // Deep emerald background gradient
        const t = y / height;
        rawData[px] = Math.round(21 * (1 - t) + 4 * t);
        rawData[px + 1] = Math.round(128 * (1 - t) + 120 * t);
        rawData[px + 2] = Math.round(61 * (1 - t) + 87 * t);
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Generate apple-touch-icon.png (180x180)
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 21, 128, 61));
console.log('Created public/apple-touch-icon.png (180x180)');

// Generate pwa-192x192.png
fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, 21, 128, 61));
console.log('Created public/pwa-192x192.png');

// Generate pwa-512x512.png
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, 21, 128, 61));
console.log('Created public/pwa-512x512.png');

// Generate pwa-maskable-512x512.png
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, 21, 128, 61));
console.log('Created public/pwa-maskable-512x512.png');
