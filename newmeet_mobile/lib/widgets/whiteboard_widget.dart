import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/livekit_service.dart';

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
  List<DrawingStroke> _strokes = [];
  List<DrawingStroke> _localStrokes = [];
  DrawingStroke? _currentStroke;
  bool _isDrawing = false;
  Color _currentColor = Colors.black;
  double _currentWidth = 4.0;
  String _currentTool = 'pen';
  String? _participantId;
  bool _isConnected = false;
  
  // Colors palette
  final List<Color> _colors = [
    Colors.black,
    Colors.red,
  ];
  
  // Brush sizes
  final List<double> _brushSizes = [2, 4, 8, 12];

  @override
  void initState() {
    super.initState();
    _setupLiveKitListener();
  }

  void _setupLiveKitListener() {
    // Set up the LiveKit data callback
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    liveKitService.setWhiteboardDataCallback(_onWhiteboardDataReceived);
    
    // Get participant info
    if (liveKitService.localParticipant != null) {
      _participantId = liveKitService.localParticipant!.identity;
      _isConnected = liveKitService.isConnected;
    }
  }

  void _onWhiteboardDataReceived(Map<String, dynamic> data) {
    print('📥 Whiteboard: Received data - ${data['type']}');
    print('📥 Whiteboard: Full data: $data');
    print('📥 Whiteboard: Data keys: ${data.keys.toList()}');
    
    if (mounted) {
      setState(() {
        final dataType = data['type'] as String?;
        print('📥 Whiteboard: Processing data type: $dataType');
        
        if (dataType == 'stroke') {
          // Add completed stroke from other participant
          final strokeData = data['stroke'] as Map<String, dynamic>?;
          print('📥 Whiteboard: Stroke data: $strokeData');
          if (strokeData != null) {
            final stroke = _parseStrokeFromData(strokeData);
            if (stroke != null) {
              print('📥 Whiteboard: Adding stroke with ${stroke.points.length} points');
              _strokes.add(stroke);
            } else {
              print('❌ Whiteboard: Failed to parse stroke data');
            }
          }
        } else if (dataType == 'stroke_update') {
          // Real-time stroke update from other participant
          final strokeData = data['stroke'] as Map<String, dynamic>?;
          print('📥 Whiteboard: Stroke update data: $strokeData');
          if (strokeData != null) {
            final stroke = _parseStrokeFromData(strokeData);
            if (stroke != null) {
              // Update existing stroke or add new one
              final existingIndex = _strokes.indexWhere((s) => s.id == stroke.id);
              if (existingIndex >= 0) {
                print('📥 Whiteboard: Updating existing stroke at index $existingIndex');
                _strokes[existingIndex] = stroke;
              } else {
                print('📥 Whiteboard: Adding new stroke with ${stroke.points.length} points');
                _strokes.add(stroke);
              }
            } else {
              print('❌ Whiteboard: Failed to parse stroke update data');
            }
          }
        } else if (dataType == 'clear') {
          // Clear whiteboard from other participant
          print('📥 Whiteboard: Clearing whiteboard');
          _strokes.clear();
          _localStrokes.clear();
        } else if (dataType == 'whiteboard_toggle') {
          // Handle whiteboard toggle from host
          final action = data['action'] as String?;
          final isHost = data['isHost'] as bool? ?? false;
          
          if (isHost && action != null) {
            print('📥 Whiteboard: Received toggle command - $action');
            // The whiteboard state is managed by the LiveKit service
            // This is just for logging/debugging
          }
        } else {
          print('⚠️ Whiteboard: Unknown data type: $dataType');
        }
      });
    } else {
      print('⚠️ Whiteboard: Widget not mounted, ignoring data');
    }
  }

  DrawingStroke? _parseStrokeFromData(Map<String, dynamic> strokeData) {
    try {
      print('📥 Whiteboard: Parsing stroke data: $strokeData');
      
      final points = <Offset>[];
      final pointsData = strokeData['points'];
      print('📥 Whiteboard: Points data type: ${pointsData.runtimeType}');
      
      if (pointsData != null && pointsData is List) {
        print('📥 Whiteboard: Processing ${pointsData.length} points');
        for (int i = 0; i < pointsData.length; i++) {
          final pointData = pointsData[i];
          print('📥 Whiteboard: Point $i: $pointData (type: ${pointData.runtimeType})');
          
          if (pointData is Map<String, dynamic> && pointData['x'] != null && pointData['y'] != null) {
            final x = (pointData['x'] as num).toDouble();
            final y = (pointData['y'] as num).toDouble();
            points.add(Offset(x, y));
            print('📥 Whiteboard: Added point: ($x, $y)');
          } else {
            print('⚠️ Whiteboard: Invalid point data: $pointData');
          }
        }
      } else {
        print('⚠️ Whiteboard: No valid points data found');
      }

      final strokeId = (strokeData['id'] as String?) ?? DateTime.now().millisecondsSinceEpoch.toString();
      final color = _parseColor(strokeData['color']);
      final width = (strokeData['width'] as num?)?.toDouble() ?? 4.0;
      final tool = (strokeData['tool'] as String?) ?? 'pen';
      
      print('📥 Whiteboard: Creating stroke - ID: $strokeId, Color: $color, Width: $width, Tool: $tool, Points: ${points.length}');

      return DrawingStroke(
        id: strokeId,
        points: points,
        color: color,
        width: width,
        tool: tool,
      );
    } catch (e) {
      print('❌ Whiteboard: Error parsing stroke data: $e');
      print('❌ Whiteboard: Stack trace: ${StackTrace.current}');
      return null;
    }
  }

  Color _parseColor(dynamic colorData) {
    if (colorData is String) {
      // Handle hex color strings
      if (colorData.startsWith('#')) {
        return Color(int.parse(colorData.substring(1), radix: 16) + 0xFF000000);
      }
      // Handle color names
      switch (colorData.toLowerCase()) {
        case 'black': return Colors.black;
        case 'red': return Colors.red;
        case 'green': return Colors.green;
        case 'blue': return Colors.blue;
        case 'yellow': return Colors.yellow;
        case 'orange': return Colors.orange;
        case 'purple': return Colors.purple;
        case 'pink': return Colors.pink;
        case 'cyan': return Colors.cyan;
        case 'brown': return Colors.brown;
        default: return Colors.black;
      }
    } else if (colorData is int) {
      return Color(colorData);
    }
    return Colors.black;
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final safeArea = MediaQuery.of(context).padding;
    
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Compact Header with Tools
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top row - Close button and connection status
                Row(
                  children: [
                    // Enhanced Close Button
                    GestureDetector(
                      onTap: widget.onClose,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.red.shade300, width: 1),
                        ),
                        child: Icon(
                          Icons.close_rounded,
                          color: Colors.red.shade700,
                          size: 20,
                        ),
                      ),
                    ),
                    
                    const Spacer(),
                    
                    // Connection Status
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _isConnected ? Colors.green.shade100 : Colors.red.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isConnected ? Colors.green : Colors.red,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _isConnected ? 'Connected' : 'Disconnected',
                            style: TextStyle(
                              fontSize: 10,
                              color: _isConnected ? Colors.green.shade700 : Colors.red.shade700,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(width: 8),
                    
                    // Clear Button
                    IconButton(
                      onPressed: _clearWhiteboard,
                      icon: const Icon(Icons.clear, size: 20),
                      tooltip: 'Clear',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    ),
                  ],
                ),
                
                const SizedBox(height: 8),
                
                // Bottom row - Tool selection and color palette
                Row(
                  children: [
                    // Tool Selection
                    Row(
                      children: [
                        _buildCompactToolButton('pen', Icons.edit),
                        const SizedBox(width: 8),
                        _buildCompactToolButton('eraser', Icons.auto_fix_high),
                      ],
                    ),
                    
                    const SizedBox(width: 8),
                    
                    // Color Palette
                    Expanded(
                      child: Row(
                        children: _colors.map((color) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 1),
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _currentColor = color;
                                });
                              },
                              child: Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color: color,
                                  shape: BoxShape.circle,
                                  border: _currentColor == color
                                      ? Border.all(color: Colors.black, width: 2)
                                      : Border.all(color: Colors.grey.shade400, width: 1),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    
                    const SizedBox(width: 12),
                    
                    // Brush Size
                    Row(
                      children: _brushSizes.map((size) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 1),
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _currentWidth = size;
                              });
                            },
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: _currentWidth == size
                                    ? Colors.blue.shade100
                                    : Colors.grey.shade200,
                                shape: BoxShape.circle,
                                border: _currentWidth == size
                                    ? Border.all(color: Colors.blue, width: 2)
                                    : null,
                              ),
                              child: Center(
                                child: Container(
                                  width: size.clamp(2.0, 16.0),
                                  height: size.clamp(2.0, 16.0),
                                  decoration: BoxDecoration(
                                    color: Colors.black,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Drawing Canvas - Fixed size to fit screen
          Expanded(
            child: Container(
              width: double.infinity,
              height: double.infinity,
              child: GestureDetector(
                onPanStart: _onPanStart,
                onPanUpdate: _onPanUpdate,
                onPanEnd: _onPanEnd,
                child: CustomPaint(
                  painter: WhiteboardPainter(_strokes + _localStrokes + (_currentStroke != null ? [_currentStroke!] : [])),
                  size: Size.infinite,
                ),
              ),
            ),
          ),
          
        ],
      ),
    );
  }

  Widget _buildToolButton(String tool, IconData icon, String label) {
    final isSelected = _currentTool == tool;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentTool = tool;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue : Colors.grey.shade300,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.black,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.black,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactToolButton(String tool, IconData icon) {
    final isSelected = _currentTool == tool;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentTool = tool;
        });
      },
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue : Colors.grey.shade200,
          shape: BoxShape.circle,
          border: isSelected ? Border.all(color: Colors.blue, width: 2) : null,
        ),
        child: Icon(
          icon,
          color: isSelected ? Colors.white : Colors.black,
          size: 20,
        ),
      ),
    );
  }

  void _onPanStart(DragStartDetails details) {
    setState(() {
      _isDrawing = true;
      final strokeId = '${DateTime.now().millisecondsSinceEpoch}-${_participantId ?? 'unknown'}';
      _currentStroke = DrawingStroke(
        id: strokeId,
        points: [details.localPosition],
        color: _currentTool == 'eraser' ? Colors.white : _currentColor, // Match web behavior
        width: _currentWidth,
        tool: _currentTool,
      );
    });
  }

  void _onPanUpdate(DragUpdateDetails details) {
    if (_isDrawing && _currentStroke != null) {
      setState(() {
        _currentStroke!.points.add(details.localPosition);
      });
      
      // Send real-time stroke update to other participants
      _sendStrokeUpdate(_currentStroke!);
    }
  }

  void _onPanEnd(DragEndDetails details) {
    if (_isDrawing && _currentStroke != null) {
      setState(() {
        _localStrokes.add(_currentStroke!);
        _isDrawing = false;
        _currentStroke = null;
      });
      
      // Send completed stroke data to other participants
      _sendStrokeData(_localStrokes.last);
    }
  }

  void _sendStrokeData(DrawingStroke stroke) {
    final data = {
      'type': 'stroke',
      'stroke': {
        'id': stroke.id,
        'points': stroke.points.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
        'color': _colorToHex(stroke.color),
        'width': stroke.width,
        'tool': stroke.tool,
      },
    };
    widget.onSendData(data);
  }

  void _sendStrokeUpdate(DrawingStroke stroke) {
    final data = {
      'type': 'stroke_update',
      'stroke': {
        'id': stroke.id,
        'points': stroke.points.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
        'color': _colorToHex(stroke.color),
        'width': stroke.width,
        'tool': stroke.tool,
      },
    };
    widget.onSendData(data);
  }

  String _colorToHex(Color color) {
    return '#${color.value.toRadixString(16).substring(2).toUpperCase()}';
  }

  void _clearWhiteboard() {
    setState(() {
      _strokes.clear();
      _localStrokes.clear();
    });
    
    // Send clear command to other participants
    final data = {'type': 'clear'};
    widget.onSendData(data);
  }

  void _downloadWhiteboard() {
    // TODO: Implement whiteboard download functionality
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Download functionality coming soon!')),
    );
  }
}

class DrawingStroke {
  final String id;
  final List<Offset> points;
  final Color color;
  final double width;
  final String tool;

  DrawingStroke({
    required this.id,
    required this.points,
    required this.color,
    required this.width,
    required this.tool,
  });
}

class WhiteboardPainter extends CustomPainter {
  final List<DrawingStroke> strokes;

  WhiteboardPainter(this.strokes);

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      if (stroke.points.isEmpty) continue;

      final paint = Paint()
        ..color = stroke.tool == 'eraser' ? Colors.white : stroke.color
        ..strokeWidth = stroke.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      final path = Path();
      path.moveTo(stroke.points.first.dx, stroke.points.first.dy);
      
      for (int i = 1; i < stroke.points.length; i++) {
        path.lineTo(stroke.points[i].dx, stroke.points[i].dy);
      }
      
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(WhiteboardPainter oldDelegate) {
    return oldDelegate.strokes != strokes;
  }
}
