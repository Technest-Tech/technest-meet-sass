/// Collaborative whiteboard widget
/// Full-featured whiteboard with layers, collaboration, undo/redo, and all drawing tools

import 'dart:async';
import '../utils/logger.dart';
import 'dart:convert';
import '../utils/logger.dart';
import 'dart:ui' as ui;
import '../utils/logger.dart';
import 'package:flutter/material.dart';
import '../utils/logger.dart';
import 'package:provider/provider.dart';
import '../utils/logger.dart';
import '../models/whiteboard_models.dart';
import '../utils/logger.dart';
import '../services/livekit_service.dart';
import '../utils/logger.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../utils/whiteboard_utils.dart';
import '../utils/logger.dart';
import 'whiteboard/whiteboard_toolbar.dart';
import '../utils/logger.dart';

class WhiteboardWidget extends StatefulWidget {
  final VoidCallback onClose;
  final Function(Map<String, dynamic>) onSendData;

  const WhiteboardWidget({
    super.key,
    required this.onClose,
    required this.onSendData,
  });

  @override
  State<WhiteboardWidget> createState() => _WhiteboardWidgetState();
}

class _WhiteboardWidgetState extends State<WhiteboardWidget> {
  // Canvas and rendering
  final GlobalKey _canvasKey = GlobalKey();
  ui.PictureRecorder? _pictureRecorder;
  CustomPaint? _customPaint;

  // Participant state
  String? _participantId;
  bool _isConnected = false;
  
  // Tool state
  ToolType _currentTool = ToolType.pen;
  String _currentColor = '#000000';
  double _currentWidth = 3.0;
  double _currentOpacity = 1.0;
  bool _fillShapes = false;

  // Text tool state
  double _fontSize = 16.0;
  String _fontFamily = 'Arial';
  bool _isTextInputActive = false;
  Point? _textInputPosition;
  final TextEditingController _textController = TextEditingController();
  final FocusNode _textFocusNode = FocusNode();

  // Drawing state
  bool _isDrawing = false;
  DrawAction? _currentAction;
  List<DrawAction> _actions = [];

  // History state (undo/redo) - synchronized across all participants
  List<List<DrawAction>> _history = [[]];
  int _historyStep = 0;

  // Layer state - synchronized across all participants
  List<Layer> _layers = [
    Layer(
      id: 'layer-1',
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 1.0,
      zIndex: 0,
    ),
  ];
  String _activeLayerId = 'layer-1';

  // Canvas state
  Size _canvasSize = const Size(800, 600);
  double _zoom = 1.0;
  Point _pan = Point(x: 0, y: 0);
  bool _isPanning = false;
  Point? _panStart;

  // Background state
  String _backgroundColor = '#ffffff';
  bool _showGrid = false;
  double _gridSize = 20.0;

  // UI state
  bool _isUploadingImage = false;

  // Throttle/debounce
  DateTime _lastUpdateTime = DateTime.now();
  static const int _updateThrottleMs = 50; // 50ms throttle for mobile
  Timer? _throttleTimer;

  // Image cache
  final Map<String, ui.Image> _imageCache = {};

  @override
  void initState() {
    super.initState();
    _setupLiveKitListener();
    _textFocusNode.addListener(_onTextFocusChange);
  }

  void _setupLiveKitListener() {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    liveKitService.setWhiteboardDataCallback(_onWhiteboardDataReceived);
    
    if (liveKitService.localParticipant != null) {
      _participantId = liveKitService.localParticipant!.identity;
      _isConnected = liveKitService.isConnected;
      print('📝 Whiteboard: Participant ID set to $_participantId, connected: $_isConnected');
    } else {
      Logger.warning(' Whiteboard: No local participant available', 'whiteboard_widget');
    }
  }

  void _onTextFocusChange() {
    if (!_textFocusNode.hasFocus && _isTextInputActive) {
      _handleTextSubmit();
    }
  }

  void _onWhiteboardDataReceived(Map<String, dynamic> data) {
    if (!mounted) return;

    final dataType = data['type'] as String?;
    
    // Note: Own messages are already filtered in LiveKitService
    // by comparing participant identity from the event

      setState(() {
      switch (dataType) {
        case 'action_complete':
          final actionData = data['action'] as Map<String, dynamic>?;
          if (actionData != null) {
            try {
              final action = DrawAction.fromJson(actionData);
              _actions = [..._actions, action];
              _updateHistory();
            } catch (e) {
              Logger.error(' Error parsing action_complete: $e', e, null, 'whiteboard_widget');
            }
          }
          break;

        case 'action_update':
          final actionData = data['action'] as Map<String, dynamic>?;
          if (actionData != null) {
            try {
              _currentAction = DrawAction.fromJson(actionData);
            } catch (e) {
              Logger.error(' Error parsing action_update: $e', e, null, 'whiteboard_widget');
            }
          }
          break;

        case 'clear':
          _actions = [];
          _history = [[]];
          _historyStep = 0;
          _currentAction = null;
          break;

        case 'undo':
          final historyStep = data['historyStep'] as int?;
          final actionsData = data['actions'] as List<dynamic>?;
          if (historyStep != null && actionsData != null) {
            _historyStep = historyStep;
            _actions = actionsData
                .map((a) => DrawAction.fromJson(a as Map<String, dynamic>))
                .toList();
            _currentAction = null;
          }
          break;

        case 'redo':
          final historyStep = data['historyStep'] as int?;
          final actionsData = data['actions'] as List<dynamic>?;
          if (historyStep != null && actionsData != null) {
            _historyStep = historyStep;
            _actions = actionsData
                .map((a) => DrawAction.fromJson(a as Map<String, dynamic>))
                .toList();
            _currentAction = null;
          }
          break;

        case 'layer_add':
          final layerData = data['layer'] as Map<String, dynamic>?;
          if (layerData != null) {
            try {
              final layer = Layer.fromJson(layerData);
              _layers = [..._layers, layer];
            } catch (e) {
              Logger.error(' Error parsing layer_add: $e', e, null, 'whiteboard_widget');
            }
          }
          break;

        case 'layer_delete':
          final layerId = data['layerId'] as String?;
          final newActiveLayerId = data['newActiveLayerId'] as String?;
          if (layerId != null) {
            _layers = _layers.where((l) => l.id != layerId).toList();
            if (layerId == _activeLayerId && newActiveLayerId != null) {
              _activeLayerId = newActiveLayerId;
            }
          }
          break;

        case 'layer_update':
          final layerData = data['layer'] as Map<String, dynamic>?;
          if (layerData != null) {
            try {
              final updatedLayer = Layer.fromJson(layerData);
              _layers = _layers.map((l) {
                return l.id == updatedLayer.id ? updatedLayer : l;
              }).toList();
            } catch (e) {
              Logger.error(' Error parsing layer_update: $e', e, null, 'whiteboard_widget');
            }
          }
          break;

        case 'layer_reorder':
          final layersData = data['layers'] as List<dynamic>?;
          if (layersData != null) {
            try {
              _layers = layersData
                  .map((l) => Layer.fromJson(l as Map<String, dynamic>))
                  .toList();
            } catch (e) {
              Logger.error(' Error parsing layer_reorder: $e', e, null, 'whiteboard_widget');
            }
          }
          break;

        case 'background_update':
          final bgColor = data['backgroundColor'] as String?;
          final showGrid = data['showGrid'] as bool?;
          final gridSize = data['gridSize'] as num?;
          if (bgColor != null) _backgroundColor = bgColor;
          if (showGrid != null) _showGrid = showGrid;
          if (gridSize != null) _gridSize = gridSize.toDouble();
          break;

        case 'history_sync':
          final historyData = data['history'] as List<dynamic>?;
          final historyStep = data['historyStep'] as int?;
          final actionsData = data['actions'] as List<dynamic>?;
          if (historyData != null && historyStep != null && actionsData != null) {
            _history = historyData.map((h) {
              return (h as List<dynamic>)
                  .map((a) => DrawAction.fromJson(a as Map<String, dynamic>))
                  .toList();
            }).toList();
            _historyStep = historyStep;
            _actions = actionsData
                .map((a) => DrawAction.fromJson(a as Map<String, dynamic>))
                .toList();
          }
          break;
      }
    });
  }

  void _sendDataToParticipants(Map<String, dynamic> data) {
    // Note: Don't add sender field - web version filters by participant identity from event
    // Check data size before sending
    final jsonString = jsonEncode(data);
    final size = utf8.encode(jsonString).length;
    
    if (size > 16384) {
      Logger.warning(' Whiteboard: Data too large to send: $size bytes', 'whiteboard_widget');
      return;
    }
    
    Logger.debug(' Whiteboard: Sending data - type: ${data['type']}, size: $size bytes');
    widget.onSendData(data);
  }

  Point _getCanvasPoint(Offset localPosition) {
    final scaleX = _canvasSize.width / _canvasSize.width;
    final scaleY = _canvasSize.height / _canvasSize.height;
    final x = (localPosition.dx * scaleX - _pan.x) / _zoom;
    final y = (localPosition.dy * scaleY - _pan.y) / _zoom;
    return Point(x: x, y: y);
  }

  void _handlePanStart(DragStartDetails details) {
    final point = _getCanvasPoint(details.localPosition);

    // Check if we're in pan mode
    final isPanMode = _currentTool == ToolType.pointer;
    if (isPanMode) {
      setState(() {
        _isPanning = true;
        _panStart = point;
      });
      return;
    }

    // Text tool - show input
    if (_currentTool == ToolType.text) {
      setState(() {
        _isTextInputActive = true;
        _textInputPosition = point;
        _textController.clear();
      });
      return;
    }

    // Check if layer is locked
    final activeLayer = _layers.firstWhere(
      (l) => l.id == _activeLayerId,
      orElse: () => _layers[0],
    );
    if (activeLayer.locked) return;

    setState(() {
      _isDrawing = true;

      // Create new action based on tool
      final isShape = [
        ToolType.rectangle,
        ToolType.circle,
        ToolType.ellipse,
        ToolType.line,
        ToolType.arrow,
        ToolType.triangle,
        ToolType.star,
      ].contains(_currentTool);

      // For eraser, use white color to match web version
      final actionColor = _currentTool == ToolType.eraser ? '#ffffff' : _currentColor;
      
      _currentAction = DrawAction(
        id: generateId(),
        type: isShape ? ActionType.shape : ActionType.stroke,
        tool: _currentTool,
        color: actionColor,
        width: _currentWidth,
        opacity: _currentOpacity,
        layerId: _activeLayerId,
        fill: _fillShapes,
        shapeType: isShape ? _getShapeType(_currentTool) : null,
        startPoint: isShape ? point : null,
        endPoint: isShape ? point : null,
        points: isShape ? null : [point],
      );
    });
  }

  void _handlePanUpdate(DragUpdateDetails details) {
    if (_isPanning && _panStart != null) {
      final currentScreen = details.localPosition;
      final startScreenX = _panStart!.x * _zoom + _pan.x;
      final startScreenY = _panStart!.y * _zoom + _pan.y;

      setState(() {
        _pan = Point(
          x: _pan.x + (currentScreen.dx - startScreenX),
          y: _pan.y + (currentScreen.dy - startScreenY),
        );
        _panStart = Point(
          x: (currentScreen.dx - _pan.x) / _zoom,
          y: (currentScreen.dy - _pan.y) / _zoom,
        );
      });
      return;
    }

    if (!_isDrawing || _currentAction == null) return;

    final point = _getCanvasPoint(details.localPosition);

    setState(() {
      if (_currentAction!.type == ActionType.stroke) {
        final points = List<Point>.from(_currentAction!.points ?? []);
        points.add(point);
        _currentAction = _currentAction!.copyWith(points: points);
      } else if (_currentAction!.type == ActionType.shape) {
        _currentAction = _currentAction!.copyWith(endPoint: point);
      }
    });

    // Send real-time update (throttled)
    final now = DateTime.now();
    if (now.difference(_lastUpdateTime).inMilliseconds >= _updateThrottleMs) {
      _sendDataToParticipants({
        'type': 'action_update',
        'action': _currentAction!.toJson(),
      });
      _lastUpdateTime = now;
    }
  }

  void _handlePanEnd(DragEndDetails details) {
    if (_isPanning) {
      setState(() {
        _isPanning = false;
        _panStart = null;
      });
      return;
    }

    if (!_isDrawing || _currentAction == null) return;

    setState(() {
      _isDrawing = false;
      _actions = [..._actions, _currentAction!];
      _updateHistory();

      // Send completed action
      _sendDataToParticipants({
        'type': 'action_complete',
        'action': _currentAction!.toJson(),
      });

      _currentAction = null;
    });
  }

  void _updateHistory() {
    final newHistory = _history.sublist(0, _historyStep + 1);
    newHistory.add(List<DrawAction>.from(_actions));
    _history = newHistory;
    _historyStep = _history.length - 1;
  }

  void _handleTextSubmit() {
    if (_textController.text.trim().isEmpty) {
      setState(() {
        _isTextInputActive = false;
      });
      return;
    }

    if (_textInputPosition == null) return;

    final newAction = DrawAction(
      id: generateId(),
      type: ActionType.text,
      tool: ToolType.text,
      color: _currentColor,
      width: _currentWidth,
      opacity: _currentOpacity,
      layerId: _activeLayerId,
      text: _textController.text,
      fontSize: _fontSize,
      fontFamily: _fontFamily,
      startPoint: _textInputPosition,
    );

    setState(() {
      _actions = [..._actions, newAction];
      _updateHistory();
      _isTextInputActive = false;
      _textController.clear();
    });

    _sendDataToParticipants({
      'type': 'action_complete',
      'action': newAction.toJson(),
    });
  }

  void _handleUndo() {
    if (_historyStep > 0) {
      final newStep = _historyStep - 1;
      final newActions = _history[newStep];

      setState(() {
        _historyStep = newStep;
        _actions = List<DrawAction>.from(newActions);
        _currentAction = null;
      });

      _sendDataToParticipants({
        'type': 'undo',
        'historyStep': newStep,
        'actions': newActions.map((a) => a.toJson()).toList(),
      });
    }
  }

  void _handleRedo() {
    if (_historyStep < _history.length - 1) {
      final newStep = _historyStep + 1;
      final newActions = _history[newStep];

      setState(() {
        _historyStep = newStep;
        _actions = List<DrawAction>.from(newActions);
        _currentAction = null;
      });

      _sendDataToParticipants({
        'type': 'redo',
        'historyStep': newStep,
        'actions': newActions.map((a) => a.toJson()).toList(),
      });
    }
  }

  void _handleClear() {
    setState(() {
      _actions = [];
      _history = [[]];
      _historyStep = 0;
      _currentAction = null;
    });

    _sendDataToParticipants({'type': 'clear'});
  }

  void _handleLayersChange(List<Layer> newLayers) {
    setState(() {
      _layers = newLayers;
    });

    _sendDataToParticipants({
      'type': 'layer_reorder',
      'layers': newLayers.map((l) => l.toJson()).toList(),
    });
  }

  void _handleActiveLayerChange(String layerId) {
    setState(() {
      _activeLayerId = layerId;
    });
  }


  ShapeType? _getShapeType(ToolType tool) {
    switch (tool) {
      case ToolType.rectangle:
        return ShapeType.rectangle;
      case ToolType.circle:
        return ShapeType.circle;
      case ToolType.ellipse:
        return ShapeType.ellipse;
      case ToolType.line:
        return ShapeType.line;
      case ToolType.arrow:
        return ShapeType.arrow;
      case ToolType.triangle:
        return ShapeType.triangle;
      case ToolType.star:
        return ShapeType.star;
      default:
        return null;
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _textFocusNode.dispose();
    _throttleTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _canvasSize = Size(constraints.maxWidth, constraints.maxHeight - 100);

    return Container(
      color: AppColors.surfaceElevated.withOpacity(0.98),
      child: Column(
        children: [
              // Toolbar
              WhiteboardToolbar(
                currentTool: _currentTool,
                onToolChange: (tool) => setState(() => _currentTool = tool),
                currentColor: _currentColor,
                onColorChange: (color) => setState(() => _currentColor = color),
                currentWidth: _currentWidth,
                onWidthChange: (width) => setState(() => _currentWidth = width),
                currentOpacity: _currentOpacity,
                onOpacityChange: (opacity) =>
                    setState(() => _currentOpacity = opacity),
                fillShapes: _fillShapes,
                onFillShapesChange: (fill) =>
                    setState(() => _fillShapes = fill),
                fontSize: _fontSize,
                onFontSizeChange: (size) => setState(() => _fontSize = size),
                fontFamily: _fontFamily,
                onFontFamilyChange: (family) =>
                    setState(() => _fontFamily = family),
                backgroundColor: _backgroundColor,
                onBackgroundColorChange: (color) =>
                    setState(() => _backgroundColor = color),
                showGrid: _showGrid,
                onShowGridChange: (show) => setState(() => _showGrid = show),
                gridSize: _gridSize,
                onGridSizeChange: (size) => setState(() => _gridSize = size),
                zoom: _zoom,
                onZoomChange: (zoom) => setState(() => _zoom = zoom),
                canUndo: _historyStep > 0,
                canRedo: _historyStep < _history.length - 1,
                onUndo: _handleUndo,
                onRedo: _handleRedo,
                onClear: _handleClear,
                onClose: widget.onClose,
              ),

              // Canvas Container
              Expanded(
                child: Stack(
                  children: [
                    Row(
                      children: [
                    Expanded(
                          child: GestureDetector(
                            onPanStart: _handlePanStart,
                            onPanUpdate: _handlePanUpdate,
                            onPanEnd: _handlePanEnd,
                            child: RepaintBoundary(
                              child: CustomPaint(
                                key: _canvasKey,
                                size: _canvasSize,
                                painter: WhiteboardPainter(
                                  actions: _actions,
                                  currentAction: _currentAction,
                                  layers: _layers,
                                  backgroundColor: _backgroundColor,
                                  showGrid: _showGrid,
                                  gridSize: _gridSize,
                                  zoom: _zoom,
                                  pan: _pan,
                                  imageCache: _imageCache,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    // Text Input Overlay
                    if (_isTextInputActive && _textInputPosition != null)
                      _TextInputOverlay(
                        position: _textInputPosition!,
                        zoom: _zoom,
                        pan: _pan,
                        controller: _textController,
                        focusNode: _textFocusNode,
                        fontSize: _fontSize,
                        fontFamily: _fontFamily,
                        color: _currentColor,
                        onSubmit: _handleTextSubmit,
                    ),
                  ],
                ),
              ),

            ],
          ),
        );
      },
    );
  }
}

// Text Input Overlay Widget (separate to handle positioning)
class _TextInputOverlay extends StatelessWidget {
  final Point position;
  final double zoom;
  final Point pan;
  final TextEditingController controller;
  final FocusNode focusNode;
  final double fontSize;
  final String fontFamily;
  final String color;
  final VoidCallback onSubmit;

  const _TextInputOverlay({
    required this.position,
    required this.zoom,
    required this.pan,
    required this.controller,
    required this.focusNode,
    required this.fontSize,
    required this.fontFamily,
    required this.color,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    // Clamp position to prevent layout errors
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;
    final left = (position.x * zoom + pan.x).clamp(0.0, screenWidth - 200);
    final top = (position.y * zoom + pan.y).clamp(0.0, screenHeight - 100);
    
    return Positioned(
      left: left,
      top: top,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: 200,
          maxWidth: 400,
          maxHeight: (screenHeight - top - 20).clamp(50.0, 200.0),
        ),
      child: Container(
          padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
            color: AppColors.surfaceElevated,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: AppColors.outline),
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            autofocus: true,
            style: TextStyle(
              fontSize: fontSize,
              fontFamily: fontFamily,
              color: hexToColor(color),
            ),
            decoration: const InputDecoration(
              hintText: 'Type text...',
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            ),
            onSubmitted: (_) => onSubmit(),
            maxLines: null,
            textInputAction: TextInputAction.done,
          ),
        ),
      ),
    );
  }
}

/// Custom painter for whiteboard canvas
class WhiteboardPainter extends CustomPainter {
  final List<DrawAction> actions;
  final DrawAction? currentAction;
  final List<Layer> layers;
  final String backgroundColor;
  final bool showGrid;
  final double gridSize;
  final double zoom;
  final Point pan;
  final Map<String, ui.Image> imageCache;

  WhiteboardPainter({
    required this.actions,
    this.currentAction,
    required this.layers,
    required this.backgroundColor,
    required this.showGrid,
    required this.gridSize,
    required this.zoom,
    required this.pan,
    required this.imageCache,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Clear canvas
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = hexToColor(backgroundColor),
    );

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(canvas, size.width, size.height, gridSize, Colors.grey);
    }

    // Apply zoom and pan
    canvas.save();
    canvas.translate(pan.x, pan.y);
    canvas.scale(zoom, zoom);

    // Sort actions by layer z-index
    final sortedActions = List<DrawAction>.from(actions);
    sortedActions.sort((a, b) {
      final layerA = layers.firstWhere(
        (l) => l.id == a.layerId,
        orElse: () => layers[0],
      );
      final layerB = layers.firstWhere(
        (l) => l.id == b.layerId,
        orElse: () => layers[0],
      );
      return layerA.zIndex.compareTo(layerB.zIndex);
    });

    // Draw all actions
    for (final action in sortedActions) {
      final layer = layers.firstWhere(
        (l) => l.id == action.layerId,
        orElse: () => layers[0],
      );
      if (!layer.visible) continue;

      _drawAction(canvas, action, layer.opacity);
    }

    // Draw current action if drawing
    if (currentAction != null) {
      final layer = layers.firstWhere(
        (l) => l.id == currentAction!.layerId,
        orElse: () => layers[0],
      );
      if (layer.visible) {
        _drawAction(canvas, currentAction!, layer.opacity);
      }
    }

    canvas.restore();
  }

  void _drawAction(Canvas canvas, DrawAction action, double layerOpacity) {
    // Handle eraser specially - it should erase, not draw
    if (action.tool == ToolType.eraser && action.type == ActionType.stroke) {
      if (action.points != null && action.points!.isNotEmpty) {
        // Use dstOut blend mode with white color (matches web destination-out)
        // This erases pixels instead of drawing
        final paint = Paint()
          ..color = Colors.white
          ..blendMode = BlendMode.dstOut
          ..strokeWidth = action.width
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round;

        final path = Path();
        if (action.points!.length > 0) {
          path.moveTo(action.points![0].x, action.points![0].y);
          for (int i = 1; i < action.points!.length; i++) {
            final p0 = action.points![i - 1];
            final p1 = action.points![i];
            final midPoint = Offset(
              (p0.x + p1.x) / 2,
              (p0.y + p1.y) / 2,
            );
            path.quadraticBezierTo(p0.x, p0.y, midPoint.dx, midPoint.dy);
          }
          path.lineTo(action.points!.last.x, action.points!.last.y);
        }
        canvas.drawPath(path, paint);
      }
      return;
    }

    final color = hexToColor(action.color);
    final opacity = action.opacity * layerOpacity;

    switch (action.type) {
      case ActionType.stroke:
        if (action.points != null && action.points!.isNotEmpty) {
          // For eraser, ensure we use white color (even if action.color is different)
          final strokeColor = action.tool == ToolType.eraser 
              ? Colors.white 
              : color;
          drawStroke(
            canvas,
            action.points!,
            strokeColor,
            action.width,
            opacity,
            action.tool,
          );
        }
        break;

      case ActionType.shape:
        if (action.startPoint != null && action.endPoint != null) {
          switch (action.shapeType) {
            case ShapeType.rectangle:
              drawRectangle(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
                action.fill ?? false,
              );
              break;
            case ShapeType.circle:
              drawCircle(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
                action.fill ?? false,
              );
              break;
            case ShapeType.ellipse:
              drawEllipse(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
                action.fill ?? false,
              );
              break;
            case ShapeType.line:
              drawLine(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
              );
              break;
            case ShapeType.arrow:
              drawArrow(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
              );
              break;
            case ShapeType.triangle:
              drawTriangle(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
                action.fill ?? false,
              );
              break;
            case ShapeType.star:
              drawStar(
                canvas,
                action.startPoint!,
                action.endPoint!,
                color,
                action.width,
                opacity,
                action.fill ?? false,
              );
              break;
            case null:
              break;
          }
        }
        break;

      case ActionType.text:
        if (action.text != null && action.startPoint != null) {
          drawText(
            canvas,
            action.text!,
            action.startPoint!,
            color,
            action.fontSize ?? 16.0,
            action.fontFamily ?? 'Arial',
            opacity,
          );
        }
        break;

      case ActionType.image:
        // Image rendering would go here
        // Requires async loading and caching
        break;
    }
  }

  @override
  bool shouldRepaint(WhiteboardPainter oldDelegate) {
    return oldDelegate.actions != actions ||
        oldDelegate.currentAction != currentAction ||
        oldDelegate.layers != layers ||
        oldDelegate.backgroundColor != backgroundColor ||
        oldDelegate.showGrid != showGrid ||
        oldDelegate.gridSize != gridSize ||
        oldDelegate.zoom != zoom ||
        oldDelegate.pan != pan;
  }
}
