/**
 * GÉNÉRATEUR D'ICÔNES — PNG pur Node (zlib), aucun binaire committé.
 * Dessin : fond vert arrondi #16a34a, flèche de baisse de prix blanche
 * (symbole du chasseur de prix : le prix descend).
 * Usage : node tools/gen-icons.js
 */

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

// ---- PNG minimal RGBA ----
var CRC_TABLE = [];
for (var n = 0; n < 256; n++) {
  var c = n;
  for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  var c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, "ascii");
  var body = Buffer.concat([t, data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, W, draw) {
  var raw = Buffer.alloc((W * 4 + 1) * W);
  var o = 0;
  for (var y = 0; y < W; y++) {
    raw[o++] = 0; // filtre "none"
    for (var x = 0; x < W; x++) {
      var px = draw(x, y);
      raw[o++] = px[0]; raw[o++] = px[1]; raw[o++] = px[2]; raw[o++] = px[3];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(file, png.length, "octets");
}

// ---- dessin : fond arrondi vert + flèche descendante blanche ----
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
var BG = hex("#16a34a");
var FG = [255, 255, 255];
var RAD = 0.22; // rayon des coins en fraction de la taille

// Flèche : shaft vertical épais + pointe triangulaire vers le bas.
function drawAt(W) {
  var rad = Math.round(W * RAD);
  var shaftHalf = Math.round(W * 0.11);   // demi-largeur du shaft
  var shaftTop = Math.round(W * 0.22);
  var headTop = Math.round(W * 0.55);     // début de la pointe
  var headHalf = Math.round(W * 0.26);    // demi-largeur de la pointe
  var headBottom = Math.round(W * 0.78);  // bas de la pointe
  return function (x, y) {
    var inArrow =
      (x >= W / 2 - shaftHalf && x < W / 2 + shaftHalf && y >= shaftTop && y < headTop) ||
      (y >= headTop && y < headBottom &&
        (x - W / 2) * (headBottom - y) <= (y - headTop) * headHalf + 0.5 &&
        (x - W / 2) * (y - headBottom) >= -(y - headTop) * headHalf - 0.5);
    if (inArrow) return [FG[0], FG[1], FG[2], 255];
    // coins arrondis : transparents hors disque de coin
    var dx = x < rad ? rad - x : x >= W - rad ? x - (W - rad - 1) : 0;
    var dy = y < rad ? rad - y : y >= W - rad ? y - (W - rad - 1) : 0;
    if (dx > 0 && dy > 0 && dx * dx + dy * dy > rad * rad) return [0, 0, 0, 0];
    return [BG[0], BG[1], BG[2], 255];
  };
}

var outDir = path.join(__dirname, "..", "public", "icons");
writePNG(path.join(outDir, "icon-192.png"), 192, drawAt(192));
writePNG(path.join(outDir, "icon-512.png"), 512, drawAt(512));
console.log("Icônes générées dans", outDir);
