/**
 * Whiteboard Utilities
 * Helper functions for drawing shapes, text, and canvas manipulation
 */

export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'pointer' | 'text' | 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star';

export interface Point {
  x: number;
  y: number;
}

export interface DrawAction {
  id: string;
  type: 'stroke' | 'shape' | 'text' | 'image';
  tool: ToolType;
  points?: Point[];
  color: string;
  width: number;
  opacity: number;
  fill?: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  layerId: string;
  shapeType?: 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star';
  startPoint?: Point;
  endPoint?: Point;
  imageData?: string;
  imagePosition?: Point;
  imageSize?: { width: number; height: number };
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
}

/**
 * Draw a stroke (pen, highlighter, eraser)
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
  opacity: number,
  tool: ToolType
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
  } else if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const midPoint = {
      x: (points[i - 1].x + points[i].x) / 2,
      y: (points[i - 1].y + points[i].y) / 2,
    };
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midPoint.x, midPoint.y);
  }

  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rectangle
 */
export function drawRectangle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number,
  fill: boolean
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}

/**
 * Draw a circle
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number,
  fill: boolean
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw an ellipse
 */
export function drawEllipse(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number,
  fill: boolean
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const radiusX = Math.abs(end.x - start.x) / 2;
  const radiusY = Math.abs(end.y - start.y) / 2;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a line
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw an arrow
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  // Draw the line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Draw the arrowhead
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = width * 4;

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a triangle
 */
export function drawTriangle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number,
  fill: boolean
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); // Top point
  ctx.lineTo(x + w, y + h); // Bottom right
  ctx.lineTo(x, y + h); // Bottom left
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a star
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
  opacity: number,
  fill: boolean
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const outerRadius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
  const innerRadius = outerRadius * 0.4;
  const spikes = 5;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw text
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  color: string,
  fontSize: number,
  fontFamily: string,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line, position.x, position.y + index * fontSize * 1.2);
  });

  ctx.restore();
}

/**
 * Draw an image
 */
export function drawImage(
  ctx: CanvasRenderingContext2D,
  imageElement: HTMLImageElement,
  position: Point,
  size: { width: number; height: number },
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(imageElement, position.x, position.y, size.width, size.height);
  ctx.restore();
}

/**
 * Get text dimensions
 */
export function getTextDimensions(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string
): { width: number; height: number } {
  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = text.split('\n');
  const width = Math.max(...lines.map(line => ctx.measureText(line).width));
  const height = lines.length * fontSize * 1.2;
  ctx.restore();
  return { width, height };
}

/**
 * Clear canvas
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Fill canvas with background color
 */
export function fillCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Draw grid overlay
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;

  // Draw vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Export canvas to data URL
 */
export function exportCanvas(canvas: HTMLCanvasElement, format: 'png' | 'jpg' | 'svg' = 'png'): string {
  if (format === 'svg') {
    // For SVG, we'd need a more complex implementation
    // For now, fallback to PNG
    return canvas.toDataURL('image/png');
  }
  
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return canvas.toDataURL(mimeType, 0.95);
}

/**
 * Download canvas as file
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: 'png' | 'jpg' = 'png'): void {
  const dataURL = exportCanvas(canvas, format);
  const link = document.createElement('a');
  link.download = `${filename}.${format}`;
  link.href = dataURL;
  link.click();
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Check if point is inside rectangle
 */
export function isPointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

