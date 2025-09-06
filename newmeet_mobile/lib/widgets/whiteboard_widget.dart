import 'package:flutter/material.dart';

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
  
  // Colors palette
  final List<Color> _colors = [
    Colors.black,
    Colors.red,
    Colors.green,
    Colors.blue,
    Colors.yellow,
    Colors.orange,
    Colors.purple,
    Colors.pink,
    Colors.cyan,
    Colors.brown,
  ];
  
  // Brush sizes
  final List<double> _brushSizes = [2, 4, 6, 8, 12, 16, 20];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Whiteboard Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: Row(
              children: [
                // Close Button
                IconButton(
                  onPressed: widget.onClose,
                  icon: const Icon(Icons.close),
                ),
                const SizedBox(width: 8),
                
                // Title
                const Text(
                  'Whiteboard',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                
                const Spacer(),
                
                // Clear Button
                IconButton(
                  onPressed: _clearWhiteboard,
                  icon: const Icon(Icons.clear),
                  tooltip: 'Clear',
                ),
                
                // Download Button
                IconButton(
                  onPressed: _downloadWhiteboard,
                  icon: const Icon(Icons.download),
                  tooltip: 'Download',
                ),
              ],
            ),
          ),
          
          // Drawing Canvas
          Expanded(
            child: GestureDetector(
              onPanStart: _onPanStart,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: CustomPaint(
                painter: WhiteboardPainter(_strokes + _localStrokes),
                size: Size.infinite,
              ),
            ),
          ),
          
          // Tool Palette
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              border: Border(
                top: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: Column(
              children: [
                // Tool Selection
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildToolButton('pen', Icons.edit, 'Pen'),
                    const SizedBox(width: 16),
                    _buildToolButton('eraser', Icons.auto_fix_high, 'Eraser'),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                // Color Palette
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: _colors.map((color) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _currentColor = color;
                          });
                        },
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                            border: _currentColor == color
                                ? Border.all(color: Colors.black, width: 3)
                                : Border.all(color: Colors.grey.shade400),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                
                const SizedBox(height: 16),
                
                // Brush Size
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: _brushSizes.map((size) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _currentWidth = size;
                          });
                        },
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: _currentWidth == size
                                ? Colors.blue
                                : Colors.grey.shade300,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Container(
                              width: size,
                              height: size,
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

  void _onPanStart(DragStartDetails details) {
    setState(() {
      _isDrawing = true;
      _currentStroke = DrawingStroke(
        points: [details.localPosition],
        color: _currentTool == 'eraser' ? Colors.white : _currentColor,
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
    }
  }

  void _onPanEnd(DragEndDetails details) {
    if (_isDrawing && _currentStroke != null) {
      setState(() {
        _localStrokes.add(_currentStroke!);
        _isDrawing = false;
        _currentStroke = null;
      });
      
      // Send stroke data to other participants
      _sendStrokeData(_localStrokes.last);
    }
  }

  void _sendStrokeData(DrawingStroke stroke) {
    final data = {
      'type': 'stroke',
      'stroke': {
        'points': stroke.points.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
        'color': stroke.color.value,
        'width': stroke.width,
        'tool': stroke.tool,
      },
    };
    widget.onSendData(data);
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
  final List<Offset> points;
  final Color color;
  final double width;
  final String tool;

  DrawingStroke({
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
        ..color = stroke.color
        ..strokeWidth = stroke.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      if (stroke.tool == 'eraser') {
        paint.blendMode = BlendMode.clear;
      }

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
