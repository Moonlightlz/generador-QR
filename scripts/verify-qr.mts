/**
 * Verifies scannability: renders every module style + gradient combo through
 * the app's SVG renderer, rasterizes with sharp, decodes with jsQR, and
 * checks the decoded payload matches the input exactly.
 */
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderQRSvg, type QRDesign } from '../src/lib/qr';

const base: QRDesign = {
  content: 'https://ejemplo.com/pagina-de-prueba',
  ecLevel: 'H',
  margin: 2,
  moduleStyle: 'square',
  colorStart: '#000000',
  colorEnd: '#3b82f6',
  useGradient: false,
  gradientDirection: 'diagonal',
  bgColor: '#ffffff',
  bgTransparent: false,
  logoSrc: null,
  logoPosition: 'center',
  logoSizePct: 20,
};

// Synthetic logo: solid blue square PNG as data URI
const logoPng = await sharp({
  create: { width: 120, height: 120, channels: 4, background: { r: 37, g: 99, b: 235, alpha: 1 } },
}).png().toBuffer();
const logoDataUri = `data:image/png;base64,${logoPng.toString('base64')}`;

const cases: [string, Partial<QRDesign>][] = [
  ['square-solid', {}],
  ['rounded-solid', { moduleStyle: 'rounded' }],
  ['dots-solid', { moduleStyle: 'dots' }],
  ['square-gradient', { useGradient: true }],
  ['rounded-gradient', { moduleStyle: 'rounded', useGradient: true }],
  ['dots-gradient', { moduleStyle: 'dots', useGradient: true }],
  ['dots-gradient-margin0', { moduleStyle: 'dots', useGradient: true, margin: 0 }],
  ['wifi-payload', { content: 'WIFI:T:WPA;S:Mi Red;P:cl\\;ave123;;', moduleStyle: 'rounded' }],
  ['vcard-payload', { content: 'BEGIN:VCARD\nVERSION:3.0\nN:García;Ana;;;\nFN:Ana García\nTEL;TYPE=CELL:+5215512345678\nEND:VCARD', moduleStyle: 'dots' }],
  ['logo-center-20', { logoSrc: logoDataUri, logoSizePct: 20 }],
  ['logo-center-25-dots-gradient', { logoSrc: logoDataUri, logoSizePct: 25, moduleStyle: 'dots', useGradient: true }],
  ['logo-corner-15', { logoSrc: logoDataUri, logoSizePct: 15, logoPosition: 'bottom-right' }],
];

let failures = 0;
for (const [name, overrides] of cases) {
  const design = { ...base, ...overrides };
  const svg = renderQRSvg(design, 800);
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(800, 800)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  const ok = result?.data === design.content;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` -> decoded: ${JSON.stringify(result?.data ?? null)}`}`);
}
process.exit(failures ? 1 : 0);
