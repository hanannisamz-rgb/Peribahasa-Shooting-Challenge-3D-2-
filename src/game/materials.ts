import * as THREE from 'three';

export interface MaterialPalette {
  whiteArmor: THREE.MeshPhysicalMaterial;
  blueArmor: THREE.MeshPhysicalMaterial;
  purpleAccent: THREE.MeshPhysicalMaterial;
  cyanGlow: THREE.MeshStandardMaterial;
  darkFrame: THREE.MeshStandardMaterial;
  chromeMetal: THREE.MeshPhysicalMaterial;
  skinTone: THREE.MeshStandardMaterial;
  visorGlass: THREE.MeshPhysicalMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  plazaRingMaterial: THREE.MeshStandardMaterial;
  platformTop: THREE.MeshStandardMaterial;
  barrierBody: THREE.MeshStandardMaterial;
  shieldGlass: THREE.MeshPhysicalMaterial;
  contactShadow: THREE.MeshBasicMaterial;
}

/**
 * Converts a grayscale height canvas (0..255) into a smooth tangent-space Normal Map DataTexture.
 */
export function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength = 2.4,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 4,
): THREE.DataTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);

  const sample = (x: number, y: number) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 3x3 Sobel filter
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * w + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a paired Albedo, Normal, Roughness, and Metalness texture set for the futuristic plaza floor.
 */
export function createArenaFloorPbrSet(maxAnisotropy: number, texSize = 1024) {
  const size = texSize;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = size;
  metalCanvas.height = size;
  const mctx = metalCanvas.getContext('2d')!;

  // Base dark architectural stone-slate + metallic trim
  actx.fillStyle = '#0d1633';
  actx.fillRect(0, 0, size, size);

  hctx.fillStyle = '#909090';
  hctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#787878'; // ~0.47 roughness
  rctx.fillRect(0, 0, size, size);

  mctx.fillStyle = '#383838'; // ~0.22 dielectric-composite
  mctx.fillRect(0, 0, size, size);

  // Subtle surface imperfections / mineral grain across tiles
  for (let i = 0; i < 3200; i++) {
    const gx = ((i * 733) % size);
    const gy = ((i * 419 + Math.floor(i / 3) * 17) % size);
    const rad = 1 + (i % 4);
    const light = i % 2 === 0;
    actx.fillStyle = light ? 'rgba(148, 163, 184, 0.035)' : 'rgba(4, 9, 24, 0.06)';
    actx.fillRect(gx, gy, rad, rad);

    rctx.fillStyle = light ? 'rgba(205,205,205,0.08)' : 'rgba(65,65,65,0.08)';
    rctx.fillRect(gx, gy, rad * 1.4, rad * 1.4);
  }

  // 2x2 large beveled interlocking architectural slabs per tile
  const half = size / 2;
  const margin = Math.round(size * 0.018);

  const drawSlab = (sx: number, sy: number, sw: number, sh: number, tintAlt: boolean) => {
    const grad = actx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    grad.addColorStop(0, tintAlt ? '#14224b' : '#121f45');
    grad.addColorStop(1, tintAlt ? '#0b1430' : '#0d1736');
    actx.fillStyle = grad;
    actx.fillRect(sx + margin, sy + margin, sw - margin * 2, sh - margin * 2);

    // Height raised slab with bevel border
    hctx.fillStyle = '#dcdcdc';
    hctx.fillRect(sx + margin, sy + margin, sw - margin * 2, sh - margin * 2);
    hctx.strokeStyle = '#303030';
    hctx.lineWidth = Math.max(4, Math.round(size * 0.01));
    hctx.strokeRect(sx + margin * 0.6, sy + margin * 0.6, sw - margin * 1.2, sh - margin * 1.2);

    // Inner polished satin finish
    rctx.fillStyle = tintAlt ? '#585858' : '#646464';
    rctx.fillRect(sx + margin * 1.5, sy + margin * 1.5, sw - margin * 3, sh - margin * 3);

    // Grout channels rougher
    rctx.strokeStyle = '#d4d4d4';
    rctx.lineWidth = Math.max(4, Math.round(size * 0.014));
    rctx.strokeRect(sx + margin * 0.5, sy + margin * 0.5, sw - margin, sh - margin);

    // Metallic inlaid trim stripe
    const inset = Math.round(size * 0.045);
    actx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
    actx.lineWidth = Math.max(2, Math.round(size * 0.004));
    actx.strokeRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2);

    mctx.strokeStyle = '#e5e5e5';
    mctx.lineWidth = Math.max(3, Math.round(size * 0.008));
    mctx.strokeRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2);

    hctx.strokeStyle = '#606060';
    hctx.lineWidth = Math.max(2, Math.round(size * 0.004));
    hctx.strokeRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2);

    // Corner titanium bolt plates
    const bOff = Math.round(size * 0.065);
    const bSize = Math.max(4, Math.round(size * 0.011));
    const corners = [
      [sx + bOff, sy + bOff],
      [sx + sw - bOff, sy + bOff],
      [sx + bOff, sy + sh - bOff],
      [sx + sw - bOff, sy + sh - bOff],
    ];
    for (const [bx, by] of corners) {
      actx.fillStyle = '#38bdf8';
      actx.beginPath();
      actx.arc(bx, by, bSize * 0.48, 0, Math.PI * 2);
      actx.fill();

      hctx.fillStyle = '#ffffff';
      hctx.beginPath();
      hctx.arc(bx, by, bSize * 0.65, 0, Math.PI * 2);
      hctx.fill();

      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.arc(bx, by, bSize * 0.7, 0, Math.PI * 2);
      mctx.fill();
    }
  };

  drawSlab(0, 0, half, half, false);
  drawSlab(half, 0, half, half, true);
  drawSlab(0, half, half, half, true);
  drawSlab(half, half, half, half, false);

  // Diagonal tech ventilation louvers in center of tile
  const cx = size / 2;
  const cy = size / 2;
  actx.fillStyle = '#090e24';
  actx.beginPath();
  actx.arc(cx, cy, size * 0.055, 0, Math.PI * 2);
  actx.fill();
  actx.strokeStyle = 'rgba(139, 92, 246, 0.55)';
  actx.lineWidth = Math.max(2, size * 0.005);
  actx.stroke();

  hctx.fillStyle = '#252525';
  hctx.beginPath();
  hctx.arc(cx, cy, size * 0.055, 0, Math.PI * 2);
  hctx.fill();

  const repeat = 18;
  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);
  roughnessMap.anisotropy = maxAnisotropy;

  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  metalnessMap.wrapS = THREE.RepeatWrapping;
  metalnessMap.wrapT = THREE.RepeatWrapping;
  metalnessMap.repeat.set(repeat, repeat);
  metalnessMap.anisotropy = maxAnisotropy;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.8, repeat, repeat, maxAnisotropy);

  return { map, normalMap, roughnessMap, metalnessMap };
}

/**
 * Generates brushed micro-grain normal + roughness maps for stylized armor, hulls & metal trim.
 */
export function createArmorMicroMaps(maxAnisotropy: number) {
  const size = 512;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hctx = hCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rctx = rCanvas.getContext('2d')!;

  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

  rCanvas.getContext('2d')!.fillStyle = '#707070';
  rctx.fillRect(0, 0, size, size);

  // Fine directional brushed streaks + subtle panel seams
  for (let y = 0; y < size; y += 2) {
    const shade = 118 + ((y * 37) % 24);
    hctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    hctx.fillRect(0, y, size, 1);

    const rShade = 95 + ((y * 53) % 40);
    rctx.fillStyle = `rgb(${rShade},${rShade},${rShade})`;
    rctx.fillRect(0, y, size, 1);
  }

  // Recessed precision armor seam lines
  hctx.strokeStyle = '#383838';
  hctx.lineWidth = 3;
  hctx.strokeRect(18, 18, size - 36, size - 36);
  hctx.beginPath();
  hctx.moveTo(0, size / 2);
  hctx.lineTo(size, size / 2);
  hctx.stroke();

  rctx.strokeStyle = '#c8c8c8';
  rctx.lineWidth = 4;
  rctx.strokeRect(18, 18, size - 36, size - 36);

  const normalMap = heightCanvasToNormalTexture(hCanvas, 1.4, 2, 2, maxAnisotropy);
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.anisotropy = maxAnisotropy;

  return { normalMap, roughnessMap };
}

export function createArenaFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  return createArenaFloorPbrSet(maxAnisotropy, 512).map;
}

export function createSkyscraperPbrTextures(
  accentHex: string,
  secondaryHex: string,
  maxAnisotropy: number,
  variant: 'curtain' | 'ribbed' = 'curtain',
) {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const hCanvas = document.createElement('canvas');
  hCanvas.width = w;
  hCanvas.height = h;
  const hctx = hCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = w;
  rCanvas.height = h;
  const rctx = rCanvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = w;
  eCanvas.height = h;
  const ectx = eCanvas.getContext('2d')!;

  ctx.fillStyle = variant === 'curtain' ? '#0b1433' : '#12183b';
  ctx.fillRect(0, 0, w, h);

  hctx.fillStyle = '#b8b8b8';
  hctx.fillRect(0, 0, w, h);

  rctx.fillStyle = '#9e9e9e'; // architectural composite frame
  rctx.fillRect(0, 0, w, h);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Structural vertical mullions
  const colCount = variant === 'curtain' ? 8 : 6;
  const rowCount = 28;
  const padX = 24;
  const padY = 24;
  const cellW = (w - padX * 2) / colCount;
  const cellH = (h - padY * 2) / rowCount;

  // Vertical fins
  ctx.fillStyle = '#182454';
  hctx.fillStyle = '#ffffff';
  for (let c = 0; c <= colCount; c++) {
    const fx = padX + c * cellW - 5;
    ctx.fillRect(fx, 0, 10, h);
    hctx.fillRect(fx, 0, 10, h);
  }

  for (let r = 0; r < rowCount; r++) {
    const isSkyLobby = r % 7 === 0;
    const isAccentBand = r % 7 === 3;
    for (let c = 0; c < colCount; c++) {
      const x = padX + c * cellW + 7;
      const y = padY + r * cellH + 6;
      const winW = cellW - 14;
      const winH = cellH - 12;

      // Recessed glass height + smooth specular roughness
      hctx.fillStyle = '#404040';
      hctx.fillRect(x, y, winW, winH);
      rctx.fillStyle = '#222222';
      rctx.fillRect(x, y, winW, winH);

      const litHash = (r * 13 + c * 29 + (variant === 'ribbed' ? 7 : 0)) % 7;
      if (isSkyLobby) {
        ctx.fillStyle = c % 2 === 0 ? accentHex : secondaryHex;
        ectx.fillStyle = c % 2 === 0 ? accentHex : secondaryHex;
        ctx.fillRect(x, y, winW, winH);
        ectx.fillRect(x, y, winW, winH);
      } else if (litHash === 0 || litHash === 4) {
        // Dark reflective glass with faint interior tint
        ctx.fillStyle = '#0c1a3d';
        ctx.fillRect(x, y, winW, winH);
      } else {
        const winCol = isAccentBand
          ? accentHex
          : litHash === 1
            ? '#e0f2fe'
            : litHash === 2
              ? '#7dd3fc'
              : '#c4b5fd';
        ctx.fillStyle = winCol;
        ctx.fillRect(x, y, winW, winH);
        ectx.fillStyle = winCol;
        ectx.fillRect(x + 2, y + 2, winW - 4, winH - 4);
      }
    }

    // Horizontal spandrel ledge
    ctx.fillStyle = '#152048';
    ctx.fillRect(0, padY + r * cellH - 3, w, 5);
    hctx.fillStyle = '#dcdcdc';
    hctx.fillRect(0, padY + r * cellH - 3, w, 5);
  }

  // Architectural illuminated crown band
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 18);
  ectx.fillStyle = accentHex;
  ectx.fillRect(0, 0, w, 18);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(eCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = heightCanvasToNormalTexture(hCanvas, 2.2, 1, 1, maxAnisotropy);

  return { map, emissiveMap, roughnessMap, normalMap };
}

export function createSkyscraperFacadeTexture(
  accentHex: string,
  secondaryHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  return createSkyscraperPbrTextures(accentHex, secondaryHex, maxAnisotropy).map;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    6,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(2, 6, 20, 0.78)');
  grad.addColorStop(0.5, 'rgba(2, 6, 20, 0.36)');
  grad.addColorStop(1, 'rgba(2, 6, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function createTargetBoardTexture(
  letter: string,
  answerText: string,
  state: 'normal' | 'hover' | 'wrong' | 'correct',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 608;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // High-contrast dark backgrounds behind crisp white text
  let bgTop = '#081233';
  let bgBot = '#0d1a47';
  let borderCol = '#38bdf8';
  let badgeBg =
    letter === 'A' ? '#22d3ee' : letter === 'B' ? '#fbbf24' : '#c084fc';
  let badgeText = '#041226';

  if (state === 'hover') {
    bgTop = '#0e235c';
    bgBot = '#172c6e';
    borderCol = '#ffffff';
    badgeBg = '#ffffff';
    badgeText = '#082f49';
  } else if (state === 'wrong') {
    bgTop = '#5c0c23';
    bgBot = '#3d0818';
    borderCol = '#fb7185';
    badgeBg = '#ef4444';
    badgeText = '#ffffff';
  } else if (state === 'correct') {
    bgTop = '#064e3b';
    bgBot = '#0b3d38';
    borderCol = '#34d399';
    badgeBg = '#10b981';
    badgeText = '#ffffff';
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Clean outer border
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 18;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, w - 64, h - 64);

  // Medium-large clear letter badge (A, B, C)
  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  ctx.roundRect(54, 48, 122, 122, 26);
  ctx.fill();

  ctx.fillStyle = badgeText;
  ctx.font = '800 80px "Poppins", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 115, 112);

  // Clear status header next to badge
  ctx.textAlign = 'left';
  ctx.fillStyle =
    state === 'wrong'
      ? '#fecdd3'
      : state === 'correct'
        ? '#a7f3d0'
        : state === 'hover'
          ? '#ffffff'
          : '#bae6fd';
  ctx.font = '800 34px "Poppins", Arial, sans-serif';
  const headerMsg =
    state === 'wrong'
      ? 'KURANG TEPAT · CUBA LAGI'
      : state === 'correct'
        ? 'BETUL! TAHNIAH!'
        : `PILIHAN ${letter}`;
  ctx.fillText(headerMsg, 204, 108);

  // Divider line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(54, 192, w - 108, 3);

  // Balanced medium-sized bold answer text fitting neatly inside each target
  const maxTextWidth = w - 120;
  const maxTextHeight = h - 244;
  let chosenSize = 48;
  let chosenLineHeight = 62;
  let lines: string[] = [];

  for (let size = 50; size >= 38; size -= 3) {
    ctx.font = `700 ${size}px "Nunito", Arial, sans-serif`;
    const candidateLines = wrapText(ctx, answerText, maxTextWidth);
    const lh = Math.round(size * 1.28);
    if (candidateLines.length * lh <= maxTextHeight) {
      chosenSize = size;
      chosenLineHeight = lh;
      lines = candidateLines;
      break;
    }
    if (size === 38) {
      chosenSize = 38;
      chosenLineHeight = Math.round(38 * 1.25);
      lines = candidateLines;
    }
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${chosenSize}px "Nunito", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const totalTextHeight = lines.length * chosenLineHeight;
  const startY = 218 + Math.max(0, (maxTextHeight - totalTextHeight) / 2);

  lines.forEach((line, idx) => {
    ctx.fillText(line, 60, startY + idx * chosenLineHeight);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function drawScoreboardCanvas(
  canvas: HTMLCanvasElement,
  params: {
    stageName: string;
    questionIndex: number;
    totalQuestions: number;
    score: number;
    stars: number;
    peribahasa: string;
  },
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#08112e');
  grad.addColorStop(1, '#111a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 38px "Poppins", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAPAN SKOR ARENA · PERIBAHASA 3D', w / 2, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px "Nunito", Arial, sans-serif';
  ctx.fillText(params.stageName, w / 2, 118);

  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.fillRect(60, 144, w - 120, 3);

  const cols = [
    { label: 'SKOR SEMASA', value: `${params.score} / 70`, color: '#22d3ee' },
    {
      label: 'SOALAN',
      value: `${Math.min(params.questionIndex + 1, params.totalQuestions)} / ${params.totalQuestions}`,
      color: '#ffffff',
    },
    { label: 'BINTANG', value: `${params.stars} ★`, color: '#fbbf24' },
  ];

  cols.forEach((col, i) => {
    const cx = (w / 3) * (i + 0.5);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 22px "Nunito", Arial, sans-serif';
    ctx.fillText(col.label, cx, 198);

    ctx.fillStyle = col.color;
    ctx.font = '800 52px "Poppins", Arial, sans-serif';
    ctx.fillText(col.value, cx, 264);
  });

  ctx.fillStyle = '#070f28';
  ctx.fillRect(54, 314, w - 108, 152);
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 314, w - 108, 152);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px "Nunito", Arial, sans-serif';
  const lines = wrapText(ctx, params.peribahasa, w - 150);
  const startY = lines.length > 1 ? 372 : 398;
  lines.slice(0, 2).forEach((line, idx) => {
    ctx.fillText(line, w / 2, startY + idx * 46);
  });
}

export function createHoloBillboardTexture(
  title: string,
  subtitle: string,
  accentColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 768;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#08112e');
  grad.addColorStop(1, '#151242');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 16;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 66px "Poppins", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2 - 40);

  ctx.fillStyle = accentColor;
  ctx.font = '800 40px "Nunito", Arial, sans-serif';
  ctx.fillText(subtitle, w / 2, h / 2 + 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMaterialPalette(
  maxAnisotropy: number,
  isMobileOrSoftware = false,
): MaterialPalette {
  const floorSet = createArenaFloorPbrSet(maxAnisotropy, isMobileOrSoftware ? 512 : 1024);
  const armorMaps = createArmorMicroMaps(maxAnisotropy);
  const shadowTex = createContactShadowTexture();

  const plazaNormal = armorMaps.normalMap.clone();
  plazaNormal.repeat.set(6, 6);
  plazaNormal.needsUpdate = true;

  return {
    whiteArmor: new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.24,
      metalness: 0.14,
      clearcoat: 0.65,
      clearcoatRoughness: 0.14,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughnessMap: armorMaps.roughnessMap,
    }),
    blueArmor: new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      roughness: 0.36,
      metalness: 0.38,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: armorMaps.roughnessMap,
    }),
    purpleAccent: new THREE.MeshPhysicalMaterial({
      color: 0x7c3aed,
      roughness: 0.3,
      metalness: 0.5,
      clearcoat: 0.55,
      clearcoatRoughness: 0.15,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
    cyanGlow: new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.12,
    }),
    darkFrame: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.58,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: armorMaps.roughnessMap,
    }),
    chromeMetal: new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.14,
      metalness: 0.94,
      anisotropy: 0.75,
      clearcoat: 0.35,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
    }),
    skinTone: new THREE.MeshStandardMaterial({
      color: 0xf6c79c,
      roughness: 0.65,
      metalness: 0.0,
    }),
    visorGlass: new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.08,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      ior: 1.55,
    }),
    floorMaterial: new THREE.MeshStandardMaterial({
      map: floorSet.map,
      normalMap: floorSet.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: floorSet.roughnessMap,
      metalnessMap: floorSet.metalnessMap,
      roughness: 0.88,
      metalness: 0.72,
    }),
    plazaRingMaterial: new THREE.MeshStandardMaterial({
      color: 0x132049,
      normalMap: plazaNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.44,
      metalness: 0.45,
    }),
    platformTop: new THREE.MeshStandardMaterial({
      color: 0x1a264d,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: armorMaps.roughnessMap,
      roughness: 0.55,
      metalness: 0.6,
    }),
    barrierBody: new THREE.MeshStandardMaterial({
      color: 0x1b1a4d,
      normalMap: armorMaps.normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: armorMaps.roughnessMap,
      roughness: 0.58,
      metalness: 0.45,
    }),
    shieldGlass: new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 0.42,
      roughness: 0.1,
      metalness: 0.08,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1.0,
      side: THREE.DoubleSide,
    }),
    contactShadow: new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  };
}
