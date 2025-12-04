/// Whiteboard drawing utilities
/// Helper functions for drawing shapes, text, and canvas manipulation

import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../models/whiteboard_models.dart';

/// Generate unique ID for actions
String generateId() {
  final timestamp = DateTime.now().millisecondsSinceEpoch;
  final random = math.Random().nextInt(0x100000000).toRadixString(36);
  return '$timestamp-$random';
}

/// Draw a stroke (pen, highlighter, eraser) with smooth curves
void drawStroke(
  Canvas canvas,
  List<Point> points,
  Color color,
  double width,
  double opacity,
  ToolType tool,
) {
  if (points.length < 2) return;

  final paint = Paint()
    ..strokeWidth = width
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  // Set blend mode and color based on tool
  if (tool == ToolType.highlighter) {
    paint.color = color.withOpacity(opacity);
    paint.blendMode = BlendMode.multiply;
  } else if (tool == ToolType.eraser) {
    // For eraser, use dstOut blend mode with white color (matches web destination-out)
    // This erases pixels instead of drawing
    paint.color = Colors.white;
    paint.blendMode = BlendMode.dstOut;
  } else {
    paint.color = color.withOpacity(opacity);
  }

  final path = Path();
  path.moveTo(points[0].x, points[0].y);

  // Use quadratic curves for smooth strokes
  for (int i = 1; i < points.length; i++) {
    final midPoint = Point(
      x: (points[i - 1].x + points[i].x) / 2,
      y: (points[i - 1].y + points[i].y) / 2,
    );
    path.quadraticBezierTo(
      points[i - 1].x,
      points[i - 1].y,
      midPoint.x,
      midPoint.y,
    );
  }

  path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  canvas.drawPath(path, paint);
}

/// Draw a rectangle
void drawRectangle(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
  bool fill,
) {
  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = fill ? PaintingStyle.fill : PaintingStyle.stroke
    ..strokeWidth = fill ? 0 : width;

  final rect = Rect.fromPoints(
    Offset(start.x, start.y),
    Offset(end.x, end.y),
  );

  canvas.drawRect(rect, paint);
}

/// Draw a circle
void drawCircle(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
  bool fill,
) {
  final centerX = (start.x + end.x) / 2;
  final centerY = (start.y + end.y) / 2;
  final radius = math.sqrt(
    math.pow(end.x - start.x, 2) + math.pow(end.y - start.y, 2),
  ) / 2;

  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = fill ? PaintingStyle.fill : PaintingStyle.stroke
    ..strokeWidth = fill ? 0 : width;

  canvas.drawCircle(Offset(centerX, centerY), radius, paint);
}

/// Draw an ellipse
void drawEllipse(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
  bool fill,
) {
  final centerX = (start.x + end.x) / 2;
  final centerY = (start.y + end.y) / 2;
  final radiusX = (end.x - start.x).abs() / 2;
  final radiusY = (end.y - start.y).abs() / 2;

  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = fill ? PaintingStyle.fill : PaintingStyle.stroke
    ..strokeWidth = fill ? 0 : width;

  final rect = Rect.fromCenter(
    center: Offset(centerX, centerY),
    width: radiusX * 2,
    height: radiusY * 2,
  );

  canvas.drawOval(rect, paint);
}

/// Draw a line
void drawLine(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
) {
  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..style = PaintingStyle.stroke;

  canvas.drawLine(
    Offset(start.x, start.y),
    Offset(end.x, end.y),
    paint,
  );
}

/// Draw an arrow with arrowhead
void drawArrow(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
) {
  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..style = PaintingStyle.stroke;

  // Draw the line
  canvas.drawLine(
    Offset(start.x, start.y),
    Offset(end.x, end.y),
    paint,
  );

  // Draw the arrowhead
  final angle = math.atan2(end.y - start.y, end.x - start.x);
  final headLength = width * 4;

  final arrowPath = Path();
  arrowPath.moveTo(end.x, end.y);
  arrowPath.lineTo(
    end.x - headLength * math.cos(angle - math.pi / 6),
    end.y - headLength * math.sin(angle - math.pi / 6),
  );
  arrowPath.lineTo(
    end.x - headLength * math.cos(angle + math.pi / 6),
    end.y - headLength * math.sin(angle + math.pi / 6),
  );
  arrowPath.close();

  final arrowPaint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = PaintingStyle.fill;

  canvas.drawPath(arrowPath, arrowPaint);
}

/// Draw a triangle
void drawTriangle(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
  bool fill,
) {
  final x = math.min(start.x, end.x);
  final y = math.min(start.y, end.y);
  final w = (end.x - start.x).abs();
  final h = (end.y - start.y).abs();

  final path = Path();
  path.moveTo(x + w / 2, y); // Top point
  path.lineTo(x + w, y + h); // Bottom right
  path.lineTo(x, y + h); // Bottom left
  path.close();

  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = fill ? PaintingStyle.fill : PaintingStyle.stroke
    ..strokeWidth = fill ? 0 : width;

  canvas.drawPath(path, paint);
}

/// Draw a star
void drawStar(
  Canvas canvas,
  Point start,
  Point end,
  Color color,
  double width,
  double opacity,
  bool fill,
) {
  final centerX = (start.x + end.x) / 2;
  final centerY = (start.y + end.y) / 2;
  final outerRadius = math.sqrt(
    math.pow(end.x - start.x, 2) + math.pow(end.y - start.y, 2),
  ) / 2;
  final innerRadius = outerRadius * 0.4;
  const spikes = 5;

  final path = Path();
  for (int i = 0; i < spikes * 2; i++) {
    final radius = i % 2 == 0 ? outerRadius : innerRadius;
    final angle = (i * math.pi) / spikes - math.pi / 2;
    final x = centerX + radius * math.cos(angle);
    final y = centerY + radius * math.sin(angle);

    if (i == 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();

  final paint = Paint()
    ..color = color.withOpacity(opacity)
    ..style = fill ? PaintingStyle.fill : PaintingStyle.stroke
    ..strokeWidth = fill ? 0 : width;

  canvas.drawPath(path, paint);
}

/// Draw text on canvas
void drawText(
  Canvas canvas,
  String text,
  Point position,
  Color color,
  double fontSize,
  String fontFamily,
  double opacity,
) {
  final textStyle = TextStyle(
    color: color.withOpacity(opacity),
    fontSize: fontSize,
    fontFamily: fontFamily,
  );

  final textSpan = TextSpan(text: text, style: textStyle);
  final textPainter = TextPainter(
    text: textSpan,
    textDirection: TextDirection.ltr,
    textAlign: TextAlign.left,
  );
  textPainter.layout();

  final lines = text.split('\n');
  for (int i = 0; i < lines.length; i++) {
    final lineSpan = TextSpan(text: lines[i], style: textStyle);
    final linePainter = TextPainter(
      text: lineSpan,
      textDirection: TextDirection.ltr,
    );
    linePainter.layout();
    linePainter.paint(
      canvas,
      Offset(position.x, position.y + i * fontSize * 1.2),
    );
  }
}

/// Draw an image on canvas
Future<void> drawImage(
  Canvas canvas,
  ui.Image image,
  Point position,
  ImageSize size,
  double opacity,
) async {
  final paint = Paint()..color = Colors.white.withOpacity(opacity);

  canvas.drawImageRect(
    image,
    Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
    Rect.fromLTWH(position.x, position.y, size.width, size.height),
    paint,
  );
}

/// Draw grid overlay
void drawGrid(
  Canvas canvas,
  double width,
  double height,
  double gridSize,
  Color color,
) {
  final paint = Paint()
    ..color = color.withOpacity(0.2)
    ..strokeWidth = 1;

  // Draw vertical lines
  for (double x = 0; x <= width; x += gridSize) {
    canvas.drawLine(
      Offset(x, 0),
      Offset(x, height),
      paint,
    );
  }

  // Draw horizontal lines
  for (double y = 0; y <= height; y += gridSize) {
    canvas.drawLine(
      Offset(0, y),
      Offset(width, y),
      paint,
    );
  }
}

/// Calculate distance between two points
double distance(Point p1, Point p2) {
  return math.sqrt(
    math.pow(p2.x - p1.x, 2) + math.pow(p2.y - p1.y, 2),
  );
}

/// Check if point is inside rectangle
bool isPointInRect(
  Point point,
  Rect rect,
) {
  return point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
}

/// Convert hex color string to Color
Color hexToColor(String hexString) {
  final buffer = StringBuffer();
  if (hexString.length == 6 || hexString.length == 7) {
    buffer.write('ff'); // Add alpha if missing
  }
  buffer.write(hexString.replaceFirst('#', ''));
  return Color(int.parse(buffer.toString(), radix: 16));
}

/// Convert Color to hex string
String colorToHex(Color color) {
  return '#${color.value.toRadixString(16).substring(2).toUpperCase()}';
}

/// Parse color from dynamic value (handles both string and int)
Color parseColor(dynamic colorData) {
  if (colorData is String) {
    if (colorData.startsWith('#')) {
      return hexToColor(colorData);
    }
    // Handle color names
    switch (colorData.toLowerCase()) {
      case 'black':
        return Colors.black;
      case 'red':
        return Colors.red;
      case 'green':
        return Colors.green;
      case 'blue':
        return Colors.blue;
      case 'yellow':
        return Colors.yellow;
      case 'orange':
        return Colors.orange;
      case 'purple':
        return Colors.purple;
      case 'pink':
        return Colors.pink;
      case 'cyan':
        return Colors.cyan;
      case 'brown':
        return Colors.brown;
      default:
        return Colors.black;
    }
  } else if (colorData is int) {
    return Color(colorData);
  }
  return Colors.black;
}

