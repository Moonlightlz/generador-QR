import QRCode from 'qrcode';

export type ModuleStyle = 'square' | 'rounded' | 'dots';
export type GradientDirection = 'vertical' | 'horizontal' | 'diagonal';
export type LogoPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ECLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRDesign {
  content: string;
  ecLevel: ECLevel;
  margin: number; // quiet zone, in modules
  moduleStyle: ModuleStyle;
  colorStart: string;
  colorEnd: string;
  useGradient: boolean;
  gradientDirection: GradientDirection;
  bgColor: string;
  bgTransparent: boolean;
  logoSrc: string | null;
  logoPosition: LogoPosition;
  logoSizePct: number; // % of total width
}

interface Matrix {
  size: number;
  get: (row: number, col: number) => boolean;
}

const FINDER = 7;

function isInFinder(row: number, col: number, size: number): boolean {
  return (
    (row < FINDER && col < FINDER) ||
    (row < FINDER && col >= size - FINDER) ||
    (row >= size - FINDER && col < FINDER)
  );
}

function createMatrix(content: string, ecLevel: ECLevel): Matrix {
  const qr = QRCode.create(content, { errorCorrectionLevel: ecLevel });
  const { size, data } = qr.modules;
  return {
    size,
    get: (row, col) => data[row * size + col] === 1,
  };
}

function gradientCoords(dir: GradientDirection, px: number): [number, number, number, number] {
  if (dir === 'vertical') return [0, 0, 0, px];
  if (dir === 'horizontal') return [0, 0, px, 0];
  return [0, 0, px, px];
}

/** Draws one finder pattern (outer 7x7 ring + inner 3x3 core) as path on ctx. */
function traceFinder(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cell: number,
  style: ModuleStyle,
) {
  const r = style === 'square' ? 0 : cell * (style === 'dots' ? 2.4 : 1.4);
  const outer = FINDER * cell;
  const innerHole = 5 * cell;
  const core = 3 * cell;
  // Outer ring: outer rect clockwise + hole counter-clockwise (even-odd via path direction)
  ctx.beginPath();
  ctx.roundRect(ox, oy, outer, outer, r);
  ctx.roundRect(ox + cell, oy + cell, innerHole, innerHole, r * 0.72);
  ctx.fill('evenodd');
  // Core
  ctx.beginPath();
  ctx.roundRect(ox + 2 * cell, oy + 2 * cell, core, core, r * 0.55);
  ctx.fill();
}

/** Renders the "ink" (dark modules) in black onto a transparent canvas. */
function renderInk(matrix: Matrix, px: number, margin: number, style: ModuleStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  const total = matrix.size + margin * 2;
  const cell = px / total;
  const off = margin * cell;

  ctx.fillStyle = '#000000';

  // Finder patterns drawn as continuous shapes for scannability + aesthetics
  traceFinder(ctx, off, off, cell, style);
  traceFinder(ctx, off + (matrix.size - FINDER) * cell, off, cell, style);
  traceFinder(ctx, off, off + (matrix.size - FINDER) * cell, cell, style);

  // Small overlap so adjacent square/rounded modules fuse without hairline gaps
  const bleed = style === 'dots' ? 0 : cell * 0.04;

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col) || isInFinder(row, col, matrix.size)) continue;
      const x = off + col * cell;
      const y = off + row * cell;
      if (style === 'dots') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'rounded') {
        ctx.beginPath();
        ctx.roundRect(x - bleed, y - bleed, cell + bleed * 2, cell + bleed * 2, cell * 0.32);
        ctx.fill();
      } else {
        ctx.fillRect(x - bleed, y - bleed, cell + bleed * 2, cell + bleed * 2);
      }
    }
  }
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function logoRect(px: number, position: LogoPosition, sizePct: number) {
  const size = px * (sizePct / 100);
  const pad = px * 0.04;
  let x: number, y: number;
  switch (position) {
    case 'center': x = (px - size) / 2; y = (px - size) / 2; break;
    case 'top-left': x = pad; y = pad; break;
    case 'top-right': x = px - size - pad; y = pad; break;
    case 'bottom-left': x = pad; y = px - size - pad; break;
    case 'bottom-right': x = px - size - pad; y = px - size - pad; break;
  }
  return { x, y, size };
}

/**
 * Renders the full QR design to a canvas of `px` x `px` pixels.
 * Pure function of the design: same input always produces the same code.
 */
export async function renderQRCanvas(design: QRDesign, px: number): Promise<HTMLCanvasElement> {
  const matrix = createMatrix(design.content, design.ecLevel);
  const ink = renderInk(matrix, px, design.margin, design.moduleStyle);

  // Colorize ink
  const colored = document.createElement('canvas');
  colored.width = px;
  colored.height = px;
  const cctx = colored.getContext('2d')!;
  if (design.useGradient) {
    const [x0, y0, x1, y1] = gradientCoords(design.gradientDirection, px);
    const grad = cctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, design.colorStart);
    grad.addColorStop(1, design.colorEnd);
    cctx.fillStyle = grad;
  } else {
    cctx.fillStyle = design.colorStart;
  }
  cctx.fillRect(0, 0, px, px);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(ink, 0, 0);

  // Compose final
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  if (!design.bgTransparent) {
    ctx.fillStyle = design.bgColor;
    ctx.fillRect(0, 0, px, px);
  }
  ctx.drawImage(colored, 0, 0);

  if (design.logoSrc) {
    const logo = await loadImage(design.logoSrc);
    const { x, y, size } = logoRect(px, design.logoPosition, design.logoSizePct);
    const pad = size * 0.09;
    ctx.fillStyle = design.bgTransparent ? '#ffffff' : design.bgColor;
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, size * 0.12);
    ctx.fill();
    ctx.drawImage(logo, x, y, size, size);
  }
  return canvas;
}

function svgModulePath(matrix: Matrix, margin: number, style: ModuleStyle): string {
  // Work in module units; viewBox handles scaling.
  const parts: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, r: number) => {
    if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
    return (
      `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}` +
      `a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
      `v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    );
  };
  const rectCCW = (x: number, y: number, w: number, h: number, r: number) => {
    if (r <= 0) return `M${x} ${y}v${h}h${w}v${-h}z`;
    return (
      `M${x + r} ${y}a${r} ${r} 0 0 0 ${-r} ${r}v${h - 2 * r}a${r} ${r} 0 0 0 ${r} ${r}` +
      `h${w - 2 * r}a${r} ${r} 0 0 0 ${r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 0 ${-r} ${-r}z`
    );
  };
  const circle = (cx: number, cy: number, r: number) =>
    `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

  const rBase = style === 'square' ? 0 : style === 'dots' ? 2.4 : 1.4;
  const finder = (ox: number, oy: number) => {
    parts.push(rect(ox, oy, FINDER, FINDER, rBase));
    parts.push(rectCCW(ox + 1, oy + 1, 5, 5, rBase * 0.72));
    parts.push(rect(ox + 2, oy + 2, 3, 3, rBase * 0.55));
  };
  finder(margin, margin);
  finder(margin + matrix.size - FINDER, margin);
  finder(margin, margin + matrix.size - FINDER);

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col) || isInFinder(row, col, matrix.size)) continue;
      const x = margin + col;
      const y = margin + row;
      if (style === 'dots') parts.push(circle(x + 0.5, y + 0.5, 0.5));
      else if (style === 'rounded') parts.push(rect(x - 0.02, y - 0.02, 1.04, 1.04, 0.32));
      else parts.push(rect(x - 0.02, y - 0.02, 1.04, 1.04, 0));
    }
  }
  return parts.join('');
}

/** Renders the design as a standalone vector SVG string. */
export function renderQRSvg(design: QRDesign, px: number): string {
  const matrix = createMatrix(design.content, design.ecLevel);
  const total = matrix.size + design.margin * 2;
  const path = svgModulePath(matrix, design.margin, design.moduleStyle);

  let defs = '';
  let fill = design.colorStart;
  if (design.useGradient) {
    const [x0, y0, x1, y1] = gradientCoords(design.gradientDirection, 1);
    defs =
      `<linearGradient id="g" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}">` +
      `<stop offset="0" stop-color="${design.colorStart}"/>` +
      `<stop offset="1" stop-color="${design.colorEnd}"/></linearGradient>`;
    fill = 'url(#g)';
  }

  const bg = design.bgTransparent
    ? ''
    : `<rect width="${total}" height="${total}" fill="${design.bgColor}"/>`;

  let logo = '';
  if (design.logoSrc) {
    const { x, y, size } = logoRect(total, design.logoPosition, design.logoSizePct);
    const pad = size * 0.09;
    const bgFill = design.bgTransparent ? '#ffffff' : design.bgColor;
    logo =
      `<rect x="${x - pad}" y="${y - pad}" width="${size + pad * 2}" height="${size + pad * 2}" rx="${size * 0.12}" fill="${bgFill}"/>` +
      `<image href="${design.logoSrc}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">` +
    `<defs>${defs}</defs>${bg}<path d="${path}" fill="${fill}" fill-rule="evenodd"/>${logo}</svg>`
  );
}

// ---------- Contrast / scannability ----------

function luminance(hex: string): number {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface ScanCheck {
  ok: boolean;
  inverted: boolean;
  ratio: number;
}

/** Checks foreground/background contrast. Scanners need dark modules on a light background. */
export function checkScannability(design: QRDesign): ScanCheck {
  const bgLum = design.bgTransparent ? 1 : luminance(design.bgColor);
  // Worst case for gradients: the lighter endpoint
  const fgLum = design.useGradient
    ? Math.max(luminance(design.colorStart), luminance(design.colorEnd))
    : luminance(design.colorStart);
  const ratio = (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05);
  const inverted = fgLum > bgLum;
  return { ok: !inverted && ratio >= 2.5, inverted, ratio };
}

export function isValidHex(c: string): boolean {
  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(c);
}
