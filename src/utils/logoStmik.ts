/**
 * Official Crest Logo of STMIK PGRI Arungbinang Kebumen
 * High-resolution canvas renderer & PDF image generator
 */

// Cached PNG Data URL for instantaneous PDF rendering
let cachedLogoDataUrl: string | null = null;

/**
 * Renders the official STMIK PGRI Arungbinang Kebumen logo to a Canvas element.
 * Dimensions: 500 x 500 px
 */
export function renderStmikLogoCanvas(): HTMLCanvasElement {
  const size = 500;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;

  // Anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Base Circular Shield (Black Background)
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.fillStyle = '#141416';
  ctx.fill();

  // 2. Outer White Ring
  ctx.beginPath();
  ctx.arc(cx, cy, 234, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.stroke();

  // 3. Inner White Ring (separating text band and center emblem)
  ctx.beginPath();
  ctx.arc(cx, cy, 168, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 4. Arched Text: "STMIK  PGRI" (Top Arc)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textTop = 'STMIK  PGRI';
  const radiusTop = 202;
  const topTotalAngle = Math.PI * 0.44; // ~79 degrees spread
  const topStartAngle = -Math.PI / 2 - topTotalAngle / 2;
  const topAngleStep = topTotalAngle / (textTop.length - 1);

  for (let i = 0; i < textTop.length; i++) {
    const char = textTop[i];
    if (char === ' ') continue;
    const angle = topStartAngle + i * topAngleStep;
    ctx.save();
    ctx.translate(cx + radiusTop * Math.cos(angle), cy + radiusTop * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // 5. Arched Text: "ARUNGBINANG KEBUMEN" (Bottom Arc)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 20px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textBottom = 'ARUNGBINANG KEBUMEN';
  const radiusBottom = 202;
  const bottomTotalAngle = Math.PI * 0.62; // ~111 degrees spread
  const bottomStartAngle = Math.PI / 2 - bottomTotalAngle / 2;
  const bottomAngleStep = bottomTotalAngle / (textBottom.length - 1);

  for (let i = 0; i < textBottom.length; i++) {
    const char = textBottom[i];
    if (char === ' ') continue;
    // To make text readable from left to right along bottom curve
    const angle = bottomStartAngle + i * bottomAngleStep;
    ctx.save();
    ctx.translate(cx + radiusBottom * Math.cos(angle), cy + radiusBottom * Math.sin(angle));
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // 6. Golden Wheat / Rice Stalks (Left & Right Ornaments)
  const goldColor = '#D49A17';
  const drawWheatStalk = (isLeft: boolean) => {
    ctx.save();
    ctx.fillStyle = goldColor;
    const baseAngle = isLeft ? Math.PI : 0;
    const grainCount = 5;
    const spread = 0.28; // Arc spread in radians

    for (let g = 0; g < grainCount; g++) {
      const offset = (g - 2) * (spread / (grainCount - 1));
      const angle = baseAngle + offset;
      const grainR = 202;
      const gx = cx + grainR * Math.cos(angle);
      const gy = cy + grainR * Math.sin(angle);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(angle + (isLeft ? Math.PI / 2 : -Math.PI / 2));

      // Draw rice grain ellipse
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.5, 14, isLeft ? 0.35 : -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  drawWheatStalk(true);
  drawWheatStalk(false);

  // 7. Center Emblem - Inner Background
  ctx.beginPath();
  ctx.arc(cx, cy, 164, 0, Math.PI * 2);
  ctx.fillStyle = '#141416';
  ctx.fill();

  // 8. Open Book (Buku Terbuka di tengah bawah)
  ctx.save();
  ctx.fillStyle = goldColor;
  ctx.strokeStyle = '#141416';
  ctx.lineWidth = 2.5;

  // Left & right pages of open books
  const drawBookPage = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.fill();
    ctx.stroke();

    // Horizontal page stripes
    ctx.beginPath();
    ctx.strokeStyle = '#141416';
    ctx.lineWidth = 1.8;
    ctx.moveTo(x + 4, y + h * 0.33);
    ctx.lineTo(x + w - 4, y + h * 0.33);
    ctx.moveTo(x + 4, y + h * 0.66);
    ctx.lineTo(x + w - 4, y + h * 0.66);
    ctx.stroke();
  };

  // Stack of 2 book levels on left
  drawBookPage(cx - 56, cy + 10, 44, 23);
  drawBookPage(cx - 56, cy + 36, 44, 23);

  // Stack of 2 book levels on right
  drawBookPage(cx + 12, cy + 10, 44, 23);
  drawBookPage(cx + 12, cy + 36, 44, 23);
  ctx.restore();

  // 9. Side Pillars / Candi Bentar (Gapura Kiri & Kanan)
  const drawSidePillar = (px: number) => {
    ctx.save();
    ctx.fillStyle = goldColor;
    const pw = 26;
    const ph = 110;
    const py = cy - 50;

    // Rounded pillar body
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, [13, 13, 4, 4]);
    ctx.fill();

    // 4 Horizontal slits/windows in the pillar
    ctx.fillStyle = '#141416';
    const slitH = 14;
    const slitGap = 8;
    const slitStartY = py + 20;

    for (let s = 0; s < 4; s++) {
      const sy = slitStartY + s * (slitH + slitGap);
      // Double vertical slit window
      ctx.fillRect(px + 5, sy, 6, slitH);
      ctx.fillRect(px + pw - 11, sy, 6, slitH);
    }
    ctx.restore();
  };
  drawSidePillar(cx - 93); // Left pillar
  drawSidePillar(cx + 67); // Right pillar

  // 10. Center Golden Torch (Obor)
  ctx.save();
  ctx.fillStyle = goldColor;

  // Torch stem
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 95);
  ctx.lineTo(cx + 8, cy + 95);
  ctx.lineTo(cx + 11, cy - 24);
  ctx.lineTo(cx - 11, cy - 24);
  ctx.closePath();
  ctx.fill();

  // Horizontal ring crossbar on torch
  ctx.fillRect(cx - 28, cy - 23, 56, 12);

  // Torch Cup / Mangkuk Obor
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy - 23);
  ctx.lineTo(cx + 26, cy - 23);
  ctx.lineTo(cx + 29, cy - 42);
  ctx.lineTo(cx - 29, cy - 42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 11. Red Flaming Fire (Api Obor Merah)
  ctx.save();
  ctx.fillStyle = '#E11D48'; // Bright crimson red flame
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 43);

  // Left flame tongue
  ctx.bezierCurveTo(cx - 38, cy - 70, cx - 35, cy - 95, cx - 18, cy - 105);
  ctx.bezierCurveTo(cx - 20, cy - 85, cx - 12, cy - 85, cx - 6, cy - 75);

  // Center tallest flame peak
  ctx.bezierCurveTo(cx - 10, cy - 110, cx - 4, cy - 128, cx, cy - 132);
  ctx.bezierCurveTo(cx + 4, cy - 128, cx + 10, cy - 110, cx + 6, cy - 75);

  // Right flame tongue
  ctx.bezierCurveTo(cx + 12, cy - 85, cx + 20, cy - 85, cx + 18, cy - 105);
  ctx.bezierCurveTo(cx + 35, cy - 95, cx + 38, cy - 70, cx + 24, cy - 43);

  ctx.closePath();
  ctx.fill();

  // Inner yellow highlight flame spark
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 46);
  ctx.bezierCurveTo(cx - 14, cy - 65, cx, cy - 82, cx, cy - 88);
  ctx.bezierCurveTo(cx, cy - 82, cx + 14, cy - 65, cx + 10, cy - 46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  return canvas;
}

/**
 * Returns a high-res PNG Data URL of the STMIK PGRI Kebumen logo.
 * Caches the result after the first render.
 */
export function getStmikLogoDataUrl(): string {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof document === 'undefined') return '';
  try {
    const canvas = renderStmikLogoCanvas();
    cachedLogoDataUrl = canvas.toDataURL('image/png', 1.0);
    return cachedLogoDataUrl;
  } catch {
    return '';
  }
}
