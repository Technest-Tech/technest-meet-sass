# Flutter Whiteboard Virtual Canvas Implementation Guide

## Overview
This guide explains how to implement the same fixed virtual canvas solution in the Flutter mobile app (newmeet mobile) to ensure mobile and desktop users work in the same coordinate space.

## Problem
Currently, the whiteboard canvas size matches each device's viewport, causing coordinate space mismatches:
- Desktop (1920px): coordinates 0-1920
- Mobile (375px): coordinates 0-375
- Teacher draws at x=1000 on desktop → mobile can't see it (only sees 0-375)

## Solution: Fixed Virtual Canvas
Use a fixed large virtual canvas (1920x1080) for all devices. Mobile users see a "window" into this canvas via zoom/pan.

## Implementation Steps

### 1. Define Virtual Canvas Constants

**File**: `lib/widgets/whiteboard/whiteboard_screen.dart` (or your whiteboard widget file)

```dart
// Fixed virtual canvas dimensions - all devices use the same coordinate space
const double VIRTUAL_CANVAS_WIDTH = 1920.0;
const double VIRTUAL_CANVAS_HEIGHT = 1080.0;
```

### 2. Update Canvas State Management

**Before** (viewport-based):
```dart
double canvasWidth = MediaQuery.of(context).size.width;
double canvasHeight = MediaQuery.of(context).size.height;
```

**After** (virtual canvas):
```dart
// Virtual canvas size - fixed for all devices
final Size virtualCanvasSize = const Size(VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT);

// Viewport size - actual display size
Size viewportSize = MediaQuery.of(context).size;
```

### 3. Update Coordinate Transformation

**File**: Your whiteboard gesture handler or drawing logic

```dart
// Convert viewport coordinates to virtual canvas coordinates
Offset getVirtualCanvasPoint(Offset viewportPoint, Size viewportSize, double zoom, Offset pan) {
  // Account for zoom and pan transformations
  final virtualX = (viewportPoint.dx - pan.dx) / zoom;
  final virtualY = (viewportPoint.dy - pan.dy) / zoom;
  
  return Offset(virtualX, virtualY);
}

// Convert virtual canvas coordinates to viewport coordinates
Offset getViewportPoint(Offset virtualPoint, double zoom, Offset pan) {
  final viewportX = virtualPoint.dx * zoom + pan.dx;
  final viewportY = virtualPoint.dy * zoom + pan.dy;
  
  return Offset(viewportX, viewportY);
}
```

### 4. Implement Auto-Fit on Mobile

**File**: Your whiteboard widget's `initState` or when whiteboard opens

```dart
void autoFitCanvas() {
  final isMobile = MediaQuery.of(context).size.width <= 768 || 
                   Platform.isAndroid || Platform.isIOS;
  
  if (isMobile && canvasContainerKey.currentContext != null) {
    final RenderBox? renderBox = canvasContainerKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox != null) {
      final containerSize = renderBox.size;
      final containerWidth = containerSize.width;
      final containerHeight = containerSize.height;
      
      // Calculate zoom to fit entire virtual canvas
      final zoomX = containerWidth / VIRTUAL_CANVAS_WIDTH;
      final zoomY = containerHeight / VIRTUAL_CANVAS_HEIGHT;
      final fitZoom = math.min(zoomX, zoomY) * 0.95; // 95% to add some padding
      
      // Center the canvas
      final centerX = (containerWidth - VIRTUAL_CANVAS_WIDTH * fitZoom) / 2;
      final centerY = (containerHeight - VIRTUAL_CANVAS_HEIGHT * fitZoom) / 2;
      
      setState(() {
        zoom = fitZoom;
        pan = Offset(centerX, centerY);
      });
    }
  }
}

@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    autoFitCanvas();
  });
}
```

### 5. Implement Pinch-to-Zoom

**File**: Your whiteboard gesture detector

```dart
// State variables
bool _isPinching = false;
double _pinchStartDistance = 0;
double _pinchStartZoom = 1;
Offset _pinchCenter = Offset.zero;

// Calculate distance between two touch points
double _getTouchDistance(ScaleUpdateDetails details) {
  return details.focalPointDelta.distance;
}

// Handle pinch gesture
GestureDetector(
  onScaleStart: (details) {
    if (details.pointerCount == 2) {
      _isPinching = true;
      _pinchStartDistance = details.focalPointDelta.distance;
      _pinchStartZoom = zoom;
      _pinchCenter = details.focalPoint;
    }
  },
  onScaleUpdate: (details) {
    if (_isPinching && details.pointerCount == 2) {
      final distance = details.focalPointDelta.distance;
      
      if (_pinchStartDistance > 0) {
        // Calculate zoom based on distance change
        final scale = distance / _pinchStartDistance;
        final newZoom = math.max(0.1, math.min(3.0, _pinchStartZoom * scale));
        
        // Adjust pan to zoom around the pinch center
        final zoomChange = newZoom / zoom;
        final newPanX = details.focalPoint.dx - (details.focalPoint.dx - pan.dx) * zoomChange;
        final newPanY = details.focalPoint.dy - (details.focalPoint.dy - pan.dy) * zoomChange;
        
        setState(() {
          zoom = newZoom;
          pan = Offset(newPanX, newPanY);
        });
      }
    }
  },
  onScaleEnd: (details) {
    _isPinching = false;
    _pinchStartDistance = 0;
  },
  // ... rest of your gesture handling
)
```

### 6. Implement Pan with Boundary Constraints

**File**: Your pan gesture handler

```dart
void _handlePanUpdate(DragUpdateDetails details) {
  if (_isPanning) {
    final newPanX = pan.dx + details.delta.dx;
    final newPanY = pan.dy + details.delta.dy;
    
    // Get viewport size
    final viewportSize = MediaQuery.of(context).size;
    
    // Apply boundary constraints to keep virtual canvas visible
    final maxPanX = 0.0;
    final minPanX = viewportSize.width - VIRTUAL_CANVAS_WIDTH * zoom;
    final maxPanY = 0.0;
    final minPanY = viewportSize.height - VIRTUAL_CANVAS_HEIGHT * zoom;
    
    setState(() {
      pan = Offset(
        math.max(minPanX, math.min(maxPanX, newPanX)),
        math.max(minPanY, math.min(maxPanY, newPanY)),
      );
    });
  }
}
```

### 7. Update Canvas Rendering

**File**: Your CustomPainter or canvas drawing code

```dart
@override
void paint(Canvas canvas, Size size) {
  // Clear canvas with viewport size
  canvas.drawRect(
    Rect.fromLTWH(0, 0, size.width, size.height),
    Paint()..color = backgroundColor,
  );
  
  // Apply zoom and pan transformations
  canvas.save();
  canvas.translate(pan.dx, pan.dy);
  canvas.scale(zoom, zoom);
  
  // Draw grid if enabled (on virtual canvas)
  if (showGrid) {
    _drawGrid(canvas, VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT);
  }
  
  // Draw all actions (in virtual canvas coordinates)
  for (final action in actions) {
    _drawAction(canvas, action);
  }
  
  // Draw current action if drawing
  if (currentAction != null) {
    _drawAction(canvas, currentAction!);
  }
  
  canvas.restore();
}
```

### 8. Handle Orientation Changes

**File**: Your whiteboard widget

```dart
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  // Recalculate fit when orientation changes
  WidgetsBinding.instance.addPostFrameCallback((_) {
    autoFitCanvas();
  });
}

// Or use OrientationBuilder
OrientationBuilder(
  builder: (context, orientation) {
    // Recalculate fit when orientation changes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      autoFitCanvas();
    });
    return yourWhiteboardWidget;
  },
)
```

### 9. Add "Fit to Screen" Button

**File**: Your toolbar widget

```dart
IconButton(
  icon: Icon(Icons.fit_screen),
  onPressed: () {
    autoFitCanvas();
  },
  tooltip: 'Fit to Screen',
)
```

### 10. Update Data Synchronization

**Important**: Ensure all coordinates sent via LiveKit data channel are in virtual canvas space, not viewport space.

```dart
// When sending drawing data
void sendDrawingAction(DrawAction action) {
  // Ensure action coordinates are in virtual canvas space
  final data = {
    'type': 'action_complete',
    'action': {
      'id': action.id,
      'type': action.type,
      'points': action.points, // Already in virtual canvas coordinates
      // ... other properties
    }
  };
  
  // Check data size limit (16KB)
  final jsonString = jsonEncode(data);
  final bytes = utf8.encode(jsonString);
  
  if (bytes.length > 16384) {
    // Handle large data (simplify or sample points)
    print('Data too large: ${bytes.length} bytes');
    return;
  }
  
  // Send via LiveKit data channel
  room.localParticipant?.publishData(
    bytes,
    topic: 'whiteboard',
  );
}
```

### 11. Handle Large Data Payloads

```dart
// For real-time updates, only send last N points
List<Offset> getSimplifiedPoints(List<Offset> points) {
  if (points.length <= 50) {
    return points;
  }
  // Only send last 20 points for real-time updates
  return points.sublist(points.length - 20);
}

// For completed actions, sample points if too large
List<Offset> samplePointsIfNeeded(List<Offset> points) {
  if (points.length <= 100) {
    return points;
  }
  
  // Sample points to reduce size
  final sampleRate = (points.length / 500).ceil();
  final sampled = <Offset>[];
  for (int i = 0; i < points.length; i += sampleRate) {
    sampled.add(points[i]);
  }
  // Always include last point
  if (sampled.last != points.last) {
    sampled.add(points.last);
  }
  return sampled;
}
```

## Key Flutter Packages Needed

```yaml
dependencies:
  flutter:
    sdk: flutter
  # For LiveKit integration
  livekit_client: ^latest
  # For JSON encoding
  # (already included in Flutter)
```

## Testing Checklist

- [ ] Mobile and desktop use same coordinate space (1920x1080)
- [ ] Auto-fit works when whiteboard opens on mobile
- [ ] Pinch-to-zoom works smoothly
- [ ] Pan gestures work with boundary constraints
- [ ] Orientation changes recalculate fit automatically
- [ ] "Fit to Screen" button works
- [ ] Coordinates sync correctly between devices
- [ ] Large strokes don't exceed 16KB data limit
- [ ] Drawing works at different zoom levels

## Example Widget Structure

```dart
class WhiteboardWidget extends StatefulWidget {
  @override
  _WhiteboardWidgetState createState() => _WhiteboardWidgetState();
}

class _WhiteboardWidgetState extends State<WhiteboardWidget> {
  // Virtual canvas constants
  static const double VIRTUAL_CANVAS_WIDTH = 1920.0;
  static const double VIRTUAL_CANVAS_HEIGHT = 1080.0;
  
  // State
  double zoom = 1.0;
  Offset pan = Offset.zero;
  bool isPanning = false;
  bool isPinching = false;
  
  final GlobalKey canvasContainerKey = GlobalKey();
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      autoFitCanvas();
    });
  }
  
  void autoFitCanvas() {
    // Implementation from step 4
  }
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onScaleStart: _handleScaleStart,
      onScaleUpdate: _handleScaleUpdate,
      onScaleEnd: _handleScaleEnd,
      child: Container(
        key: canvasContainerKey,
        child: CustomPaint(
          painter: WhiteboardPainter(
            virtualCanvasSize: Size(VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT),
            zoom: zoom,
            pan: pan,
            actions: actions,
            // ... other properties
          ),
        ),
      ),
    );
  }
}
```

## Differences from React Implementation

1. **State Management**: Use Flutter's `setState()` or state management (Provider, Riverpod, etc.)
2. **Canvas Rendering**: Use `CustomPainter` instead of HTML Canvas
3. **Gestures**: Use Flutter's `GestureDetector` instead of React event handlers
4. **Coordinate System**: Flutter uses top-left origin (same as web), so transformations are similar
5. **Data Channel**: Use LiveKit Flutter SDK's `publishData` method

## Notes

- All drawing coordinates must be in virtual canvas space (0-1920 for X, 0-1080 for Y)
- Viewport coordinates are only for display/input, never stored or sent
- The zoom/pan transformations are applied during rendering, not to stored coordinates
- Mobile auto-fit should run after the widget is built (use `addPostFrameCallback`)

## Success Criteria

✅ Mobile users can see and interact with the full whiteboard
✅ Coordinates sync correctly between mobile and desktop
✅ Pinch-to-zoom and pan work smoothly on mobile
✅ Auto-fit works on whiteboard open and orientation change
✅ No "Data too large" errors when drawing









