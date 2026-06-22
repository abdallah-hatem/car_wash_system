/**
 * Generates PWA icons from an inline SVG using sharp.
 * Run once:  node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, "../public")

// Inline SVG: teal (#0d9488) square background + stylised "W" drop mark in white
// The viewBox is 512x512 so we can scale cleanly.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- maskable safe zone: keep content within the inner ~80% -->
  <rect width="512" height="512" rx="80" fill="#0d9488"/>
  <!-- Water-drop shape -->
  <path d="M256 110 C256 110 148 248 148 318 C148 378 196 420 256 420 C316 420 364 378 364 318 C364 248 256 110 256 110Z" fill="white" opacity="0.25"/>
  <!-- Bold "W" mark centred at 256,280 -->
  <text
    x="256" y="340"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="210"
    text-anchor="middle"
    fill="white"
    letter-spacing="-8"
  >W</text>
</svg>`

const svgBuffer = Buffer.from(svg)

async function generate(size, filename) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(path.join(PUBLIC, filename))
  console.log(`  created: public/${filename}`)
}

console.log("Generating PWA icons…")
await generate(192, "pwa-192.png")
await generate(512, "pwa-512.png")
await generate(180, "apple-touch-icon.png")
console.log("Done.")
