import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pdfx/pdfx.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:http/http.dart' as http;
import '../models/pdf_annotation_models.dart';
import '../services/livekit_service.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';
import '../utils/responsive.dart';

class PdfViewerWidget extends StatefulWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final Map<String, dynamic>? file;
  final String roomName;
  final bool isHost;

  const PdfViewerWidget({
    super.key,
    required this.isOpen,
    required this.onClose,
    this.file,
    required this.roomName,
    required this.isHost,
  });

  @override
  State<PdfViewerWidget> createState() => _PdfViewerWidgetState();
}

class _PdfViewerWidgetState extends State<PdfViewerWidget> {
  PdfController? _pdfController;
  bool _isLoading = true;
  String? _pdfUrl;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 0;
  double _zoom = 1.0;
  
  // PDF view dimensions for coordinate normalization
  // We'll use the rendered PDF view size to normalize coordinates
  Size? _pdfViewSize; // Current rendered PDF view size
  final GlobalKey _pdfViewKey = GlobalKey(); // Key to get PDF view size

  // Drawing state
  String _currentTool = 'pen'; // 'pen', 'highlighter'
  Color _currentColor = Colors.red;
  double _currentWidth = 4.0;
  bool _isDrawing = false;
  DrawingStroke? _currentStroke;

  // Stroke storage per page
  final Map<int, List<DrawingStroke>> _strokes = {};
  bool _preventGuestDrawing = false;
  bool _showDeleteOptions = false;

  // Data channel subscription
  StreamSubscription? _dataSubscription;
  lk.EventsListener<lk.RoomEvent>? _dataListener;

  // Colors and brush sizes
  final List<Color> _colors = [
    Colors.black,
    Colors.red,
    Colors.green,
    Colors.blue,
    Colors.yellow,
  ];

  final List<double> _brushSizes = [2, 4, 8];

  @override
  void initState() {
    super.initState();
    if (widget.isOpen && widget.file != null) {
      _loadPdf();
    }
    _setupDataChannelListener();
  }

  @override
  void didUpdateWidget(PdfViewerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isOpen && widget.file != null && oldWidget.file?['id'] != widget.file?['id']) {
      _loadPdf();
    }
  }

  void _setupDataChannelListener() {
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final room = liveKitService.room;

    if (room != null) {
      _dataListener = room.createListener();
      _dataListener!.on<lk.DataReceivedEvent>(_handleDataReceived);

      // Also set up callback in LiveKitService
      liveKitService.setPdfViewerDataCallback((data) {
        if (mounted && widget.file != null) {
          final fileIdValue = widget.file!['id'];
          final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
          final dataFileId = data['fileId'] is String 
              ? data['fileId'] as String 
              : data['fileId'].toString();
          if (fileId == dataFileId) {
            _handleAnnotationData(data);
          }
        }
      });
    }
  }

  void _handleDataReceived(lk.DataReceivedEvent event) {
    try {
      final dataString = utf8.decode(event.data);
      final data = jsonDecode(dataString) as Map<String, dynamic>;
      
      // Filter own messages
      final localIdentity = Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity;
      if (event.participant?.identity == localIdentity) {
        return;
      }

      // Compare fileIds handling both String and int types
      if (widget.file == null) return;
      final fileIdValue = widget.file!['id'];
      final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
      final dataFileId = data['fileId'] is String 
          ? data['fileId'] as String 
          : data['fileId'].toString();
      if (fileId != dataFileId) {
        return;
      }

      _handleAnnotationData(data);
    } catch (e) {
      Logger.error('Error handling PDF data: $e', e, null, 'PdfViewerWidget');
    }
  }

  void _handleAnnotationData(Map<String, dynamic> data) {
    final annotationData = PdfAnnotationData.fromJson(data);

    if (annotationData.type == 'pdf_annotation_stroke' && annotationData.stroke != null) {
      setState(() {
        final pageStrokes = _strokes[annotationData.pageNumber] ?? [];
        pageStrokes.add(annotationData.stroke!);
        _strokes[annotationData.pageNumber] = pageStrokes;
      });
    } else if (annotationData.type == 'pdf_annotation_delete_all') {
      setState(() {
        _strokes[annotationData.pageNumber] = [];
      });
    } else if (annotationData.type == 'pdf_annotation_delete_host') {
      setState(() {
        final pageStrokes = _strokes[annotationData.pageNumber] ?? [];
        _strokes[annotationData.pageNumber] = pageStrokes
            .where((stroke) =>
                stroke.sender == null ||
                !stroke.sender!.toLowerCase().contains('_host_'))
            .toList();
      });
    } else if (annotationData.type == 'pdf_annotation_delete_guest') {
      setState(() {
        final pageStrokes = _strokes[annotationData.pageNumber] ?? [];
        _strokes[annotationData.pageNumber] = pageStrokes
            .where((stroke) =>
                stroke.sender != null &&
                stroke.sender!.toLowerCase().contains('_host_'))
            .toList();
      });
    } else if (annotationData.type == 'pdf_page_change' && annotationData.isHost == true) {
      _goToPage(annotationData.pageNumber);
    } else if (annotationData.type == 'pdf_prevent_guest_drawing') {
      setState(() {
        _preventGuestDrawing = annotationData.preventGuestDrawing ?? false;
      });
    } else if (annotationData.type == 'pdf_viewer_open' && annotationData.file != null) {
      // Host opened PDF - handled by parent
    } else if (annotationData.type == 'pdf_viewer_close') {
      // Host closed PDF - handled by parent
    }
  }

  Future<void> _loadPdf() async {
    if (widget.file == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Handle fileId as either String or int
      final fileIdValue = widget.file!['id'];
      final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
      _pdfUrl = ApiService.getRoomFileUrl(fileId);

      // Download PDF data first
      final pdfData = await _downloadPdfData(_pdfUrl!);
      
      // Initialize PDF controller with downloaded data
      // pdfx 2.x: PdfDocument.openData() is async and returns Future<PdfDocument>
      // PdfController expects Future<PdfDocument>, not the resolved document
      _pdfController = PdfController(
        document: PdfDocument.openData(pdfData),
        initialPage: 1,
      );

      // Get total pages - wait for document to initialize
      await Future.delayed(const Duration(milliseconds: 500));
      
      // Try to get pagesCount from controller
      int? pages = _pdfController!.pagesCount;
      
      setState(() {
        _isLoading = false;
        _currentPage = 1;
        _totalPages = pages ?? 1;
        _strokes.clear();
      });
      
      // Try to get actual page count after a delay if it was null
      if (pages == null) {
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted && _pdfController != null) {
            final actualPages = _pdfController!.pagesCount;
            if (actualPages != null && actualPages != _totalPages) {
              setState(() {
                _totalPages = actualPages;
              });
            }
          }
        });
      }
    } catch (e) {
      Logger.error('Error loading PDF: $e', e, null, 'PdfViewerWidget');
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<Uint8List> _downloadPdfData(String url) async {
    final response = await http.get(Uri.parse(url));
    if (response.statusCode == 200) {
      return response.bodyBytes;
    } else {
      throw Exception('Failed to load PDF: ${response.statusCode}');
    }
  }

  Future<void> _sendAnnotationData(PdfAnnotationData data) async {
    try {
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      await liveKitService.sendPdfAnnotationData(data.toJson());
    } catch (e) {
      Logger.error('Error sending PDF annotation: $e', e, null, 'PdfViewerWidget');
    }
  }

  void _handlePageChanged(int pageNumber) {
    if (pageNumber == _currentPage) return;
    
    setState(() {
      _currentPage = pageNumber;
    });

    // If host, broadcast page change
    if (widget.isHost && widget.file != null) {
      final fileIdValue = widget.file!['id'];
      final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
      final pageChangeData = PdfAnnotationData(
        type: 'pdf_page_change',
        fileId: fileId,
        pageNumber: pageNumber,
        sender: Provider.of<LiveKitService>(context, listen: false)
            .localParticipant
            ?.identity ?? '',
        timestamp: DateTime.now().millisecondsSinceEpoch,
        id: 'page-change-${DateTime.now().millisecondsSinceEpoch}',
        isHost: true,
      );
      _sendAnnotationData(pageChangeData);
    }
  }

  Future<void> _goToPage(int pageNumber) async {
    if (_pdfController != null && pageNumber >= 1 && pageNumber <= _totalPages) {
      // pdfx: jumpToPage returns void, not Future
      try {
        _pdfController!.jumpToPage(pageNumber);
        _handlePageChanged(pageNumber);
      } catch (e) {
        // If jumpToPage doesn't exist, try alternative method
        Logger.warning('jumpToPage failed: $e', 'PdfViewerWidget');
        // Still update our state even if navigation fails
        _handlePageChanged(pageNumber);
      }
    }
  }

  // Convert screen coordinates to normalized coordinates (0-1 range based on view size)
  // Store the view size when normalizing so we can denormalize later
  DrawingPoint _normalizeCoordinates(Offset screenPos) {
    // Get the PDF view size from the render box
    final RenderBox? renderBox = _pdfViewKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) {
      // Fallback: use screen coordinates if we don't have view size yet
      return DrawingPoint(x: screenPos.dx, y: screenPos.dy);
    }
    
    final viewSize = renderBox.size;
    
    // Store view size for later use
    if (_pdfViewSize == null || _pdfViewSize != viewSize) {
      setState(() {
        _pdfViewSize = viewSize;
      });
    }
    
    // Normalize to 0-1 range based on view size
    // We'll store coordinates as 0-1 range, and the view size separately
    // This way, when rendering, we can scale based on current view size
    final x = screenPos.dx / viewSize.width;
    final y = screenPos.dy / viewSize.height;
    
    // Store as normalized (0-1) but we need to also store the reference view size
    // For cross-platform compatibility, we'll use a standard reference size
    // Let's use 1000x1000 as a reference, so coordinates are in "normalized units"
    return DrawingPoint(
      x: x * 1000, // Scale to reference size for cross-platform compatibility
      y: y * 1000,
    );
  }
  
  // Convert normalized coordinates back to screen coordinates for rendering
  Offset _denormalizeCoordinates(DrawingPoint normalizedPoint, Size currentViewSize) {
    // Convert from normalized coordinates (0-1000 range) to screen coordinates
    final x = (normalizedPoint.x / 1000) * currentViewSize.width;
    final y = (normalizedPoint.y / 1000) * currentViewSize.height;
    
    return Offset(x, y);
  }

  void _startDrawing(Offset position) {
    if (!widget.isHost && _preventGuestDrawing) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Drawing is disabled for guests')),
      );
      return;
    }

    // Normalize coordinates to PDF page dimensions
    final normalizedPoint = _normalizeCoordinates(position);

    setState(() {
      _isDrawing = true;
      _currentStroke = DrawingStroke(
        id: '${DateTime.now().millisecondsSinceEpoch}-${DateTime.now().microsecond}',
        points: [normalizedPoint],
        color: '#${_currentColor.value.toRadixString(16).substring(2)}',
        width: _currentTool == 'highlighter' ? _currentWidth * 3 : _currentWidth,
        tool: _currentTool,
        sender: Provider.of<LiveKitService>(context, listen: false)
            .localParticipant
            ?.identity ?? '',
      );
    });
  }

  void _updateDrawing(Offset position) {
    if (!_isDrawing || _currentStroke == null) return;

    // Normalize coordinates to PDF page dimensions
    final normalizedPoint = _normalizeCoordinates(position);

    setState(() {
      _currentStroke = DrawingStroke(
        id: _currentStroke!.id,
        points: [..._currentStroke!.points, normalizedPoint],
        color: _currentStroke!.color,
        width: _currentStroke!.width,
        tool: _currentStroke!.tool,
        sender: _currentStroke!.sender,
      );
    });
  }

  void _stopDrawing() async {
    if (!_isDrawing || _currentStroke == null) return;

    setState(() {
      _isDrawing = false;
    });

    // Add stroke to current page
    final pageStrokes = _strokes[_currentPage] ?? [];
    pageStrokes.add(_currentStroke!);
    _strokes[_currentPage] = pageStrokes;

    // Broadcast stroke
    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final annotationData = PdfAnnotationData(
      type: 'pdf_annotation_stroke',
      fileId: fileId,
      pageNumber: _currentPage,
      stroke: _currentStroke,
      sender: _currentStroke!.sender ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: _currentStroke!.id,
    );

    await _sendAnnotationData(annotationData);
    _currentStroke = null;
  }

  void _clearAnnotations() {
    setState(() {
      _strokes[_currentPage] = [];
    });

    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final clearData = PdfAnnotationData(
      type: 'pdf_annotation_delete_all',
      fileId: fileId,
      pageNumber: _currentPage,
      sender: Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: 'clear-${DateTime.now().millisecondsSinceEpoch}',
    );
    _sendAnnotationData(clearData);
  }

  void _deleteHostDrawings() {
    if (!widget.isHost || widget.file == null) return;

    setState(() {
      final pageStrokes = _strokes[_currentPage] ?? [];
      _strokes[_currentPage] = pageStrokes
          .where((stroke) =>
              stroke.sender == null ||
              !stroke.sender!.toLowerCase().contains('_host_'))
          .toList();
    });

    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final deleteData = PdfAnnotationData(
      type: 'pdf_annotation_delete_host',
      fileId: fileId,
      pageNumber: _currentPage,
      sender: Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: 'delete-host-${DateTime.now().millisecondsSinceEpoch}',
    );
    _sendAnnotationData(deleteData);
    _showDeleteOptions = false;
  }

  void _deleteGuestDrawings() {
    if (!widget.isHost || widget.file == null) return;

    setState(() {
      final pageStrokes = _strokes[_currentPage] ?? [];
      _strokes[_currentPage] = pageStrokes
          .where((stroke) =>
              stroke.sender != null &&
              stroke.sender!.toLowerCase().contains('_host_'))
          .toList();
    });

    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final deleteData = PdfAnnotationData(
      type: 'pdf_annotation_delete_guest',
      fileId: fileId,
      pageNumber: _currentPage,
      sender: Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: 'delete-guest-${DateTime.now().millisecondsSinceEpoch}',
    );
    _sendAnnotationData(deleteData);
    _showDeleteOptions = false;
  }

  void _deleteAllDrawings() {
    if (widget.file == null) return;

    setState(() {
      _strokes[_currentPage] = [];
    });

    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final deleteData = PdfAnnotationData(
      type: 'pdf_annotation_delete_all',
      fileId: fileId,
      pageNumber: _currentPage,
      sender: Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: 'delete-all-${DateTime.now().millisecondsSinceEpoch}',
    );
    _sendAnnotationData(deleteData);
    
    if (widget.isHost) {
      _showDeleteOptions = false;
    }
  }

  void _toggleGuestDrawing() {
    if (!widget.isHost) return;

    final newState = !_preventGuestDrawing;
    setState(() {
      _preventGuestDrawing = newState;
    });

    final fileIdValue = widget.file!['id'];
    final fileId = fileIdValue is String ? fileIdValue : fileIdValue.toString();
    final toggleData = PdfAnnotationData(
      type: 'pdf_prevent_guest_drawing',
      fileId: fileId,
      pageNumber: _currentPage,
      sender: Provider.of<LiveKitService>(context, listen: false)
          .localParticipant
          ?.identity ?? '',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      id: 'prevent-guest-${DateTime.now().millisecondsSinceEpoch}',
      preventGuestDrawing: newState,
    );
    _sendAnnotationData(toggleData);
  }

  @override
  void dispose() {
    _dataSubscription?.cancel();
    _dataListener?.dispose();
    _pdfController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen || widget.file == null) {
      return const SizedBox.shrink();
    }

    // Calculate responsive toolbar height for proper padding
    final toolbarHeight = MediaQuery.of(context).padding.top + Responsive.value(
      context,
      phone: 180.0,
      tablet: 220.0,
    );
    
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Loading or error states
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          else if (_error != null)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: AppColors.danger),
                  const SizedBox(height: 16),
                  Text(
                    'Error loading PDF',
                    style: TextStyle(color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: TextStyle(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

          // Annotation overlay - positioned to match PDF view exactly
          // We need to stack the PDF and annotations so eraser can work properly
          if (_pdfUrl != null && !_isLoading && _pdfController != null && _error == null)
            Positioned(
              top: toolbarHeight,
              left: 0,
              right: 0,
              bottom: 0,
              child: Stack(
                children: [
                  // PDF view (background)
                  Positioned.fill(
                    child: PdfView(
                      key: _pdfViewKey,
                      controller: _pdfController!,
                      onPageChanged: (page) {
                        if (page != _currentPage) {
                          _handlePageChanged(page);
                        }
                      },
                    ),
                  ),
                  // Annotation overlay (on top)
                  Positioned.fill(
                    child: GestureDetector(
                      onPanStart: (details) => _startDrawing(details.localPosition),
                      onPanUpdate: (details) => _updateDrawing(details.localPosition),
                      onPanEnd: (_) => _stopDrawing(),
                      child: CustomPaint(
                        painter: PdfAnnotationPainter(
                          strokes: _strokes[_currentPage] ?? [],
                          currentStroke: _currentStroke,
                        ),
                        child: Container(),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Toolbar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _buildToolbar(),
          ),

          // Delete options modal
          if (_showDeleteOptions && widget.isHost)
            _buildDeleteOptionsModal(),
        ],
      ),
    );
  }

  Widget _buildToolbar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated.withOpacity(0.95),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              children: [
                Expanded(
                  child: Text(
                    '📄 ${widget.file?['originalName'] ?? 'PDF'}',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textPrimary),
                  onPressed: widget.onClose,
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Page navigation
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left, color: AppColors.textPrimary),
                  onPressed: _currentPage > 1
                      ? () => _goToPage(_currentPage - 1)
                      : null,
                ),
                Expanded(
                  child: Text(
                    'Page $_currentPage / $_totalPages',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textPrimary),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, color: AppColors.textPrimary),
                  onPressed: _currentPage < _totalPages
                      ? () => _goToPage(_currentPage + 1)
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Drawing tools
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  // Pen
                  _buildToolButton(
                    icon: Icons.edit,
                    label: 'Pen',
                    isSelected: _currentTool == 'pen',
                    onTap: () {
                      if (!widget.isHost && _preventGuestDrawing) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Drawing is disabled')),
                        );
                        return;
                      }
                      setState(() => _currentTool = 'pen');
                    },
                    enabled: widget.isHost || !_preventGuestDrawing,
                  ),
                  const SizedBox(width: 8),
                  // Highlighter
                  _buildToolButton(
                    icon: Icons.brush,
                    label: 'Highlight',
                    isSelected: _currentTool == 'highlighter',
                    onTap: () {
                      if (!widget.isHost && _preventGuestDrawing) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Drawing is disabled')),
                        );
                        return;
                      }
                      setState(() => _currentTool = 'highlighter');
                    },
                    enabled: widget.isHost || !_preventGuestDrawing,
                  ),
                  const SizedBox(width: 16),
                  // Colors
                  ..._colors.map((color) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () => setState(() => _currentColor = color),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _currentColor == color
                                    ? AppColors.primary
                                    : AppColors.outline,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      )),
                  const SizedBox(width: 16),
                  // Brush sizes
                  ..._brushSizes.map((size) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () => setState(() => _currentWidth = size),
                          child: Container(
                            width: 40,
                            height: 32,
                            decoration: BoxDecoration(
                              color: _currentWidth == size
                                  ? AppColors.primary
                                  : AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _currentWidth == size
                                    ? AppColors.primary
                                    : AppColors.outline,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                size.toInt().toString(),
                                style: TextStyle(
                                  color: _currentWidth == size
                                      ? Colors.white
                                      : AppColors.textPrimary,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ),
                      )),
                  const SizedBox(width: 16),
                  // Actions
                  if (widget.isHost)
                    IconButton(
                      icon: Icon(
                        _preventGuestDrawing ? Icons.block : Icons.edit,
                        color: AppColors.textPrimary,
                      ),
                      onPressed: _toggleGuestDrawing,
                      tooltip: _preventGuestDrawing
                          ? 'Enable guest drawing'
                          : 'Disable guest drawing',
                    ),
                  if (widget.isHost)
                    IconButton(
                      icon: const Icon(Icons.delete, color: AppColors.textPrimary),
                      onPressed: () => setState(() => _showDeleteOptions = true),
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.delete_forever, color: AppColors.textPrimary),
                      onPressed: _preventGuestDrawing ? null : _deleteAllDrawings,
                      tooltip: 'Delete all drawings',
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToolButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    bool enabled = true,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withOpacity(0.2)
              : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.outline,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: enabled
                  ? (isSelected ? AppColors.primary : AppColors.textPrimary)
                  : AppColors.textMuted,
              size: 20,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: enabled
                    ? (isSelected ? AppColors.primary : AppColors.textPrimary)
                    : AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeleteOptionsModal() {
    return GestureDetector(
      onTap: () => setState(() => _showDeleteOptions = false),
      child: Container(
        color: Colors.black54,
        child: Center(
          child: Container(
            margin: const EdgeInsets.all(24),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Text(
                      'Delete Drawings',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textPrimary),
                      onPressed: () => setState(() => _showDeleteOptions = false),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Only show "All Drawings" option
                _buildDeleteOption(
                  icon: Icons.delete_forever,
                  label: 'All Drawings',
                  onTap: _deleteAllDrawings,
                  isPrimary: true,
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => setState(() => _showDeleteOptions = false),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDeleteOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isPrimary = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isPrimary 
              ? AppColors.primary.withOpacity(0.2)
              : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(8),
          border: isPrimary
              ? Border.all(color: AppColors.primary, width: 2)
              : null,
        ),
        child: Row(
          children: [
            Icon(
              icon, 
              color: isPrimary ? AppColors.primary : AppColors.textPrimary,
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                color: isPrimary ? AppColors.primary : AppColors.textPrimary,
                fontWeight: isPrimary ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Custom painter for PDF annotations
class PdfAnnotationPainter extends CustomPainter {
  final List<DrawingStroke> strokes;
  final DrawingStroke? currentStroke;

  PdfAnnotationPainter({
    required this.strokes,
    this.currentStroke,
  });

  // Convert normalized coordinates to screen coordinates
  Offset _denormalizePoint(DrawingPoint normalizedPoint, Size canvasSize) {
    // Convert from normalized coordinates (0-1000 range) to screen coordinates
    final x = (normalizedPoint.x / 1000) * canvasSize.width;
    final y = (normalizedPoint.y / 1000) * canvasSize.height;
    
    return Offset(x, y);
  }

  @override
  void paint(Canvas canvas, Size size) {
    // Draw all strokes
    for (final stroke in strokes) {
      _drawStroke(canvas, stroke, size);
    }

    // Draw current stroke
    if (currentStroke != null) {
      _drawStroke(canvas, currentStroke!, size);
    }
  }

  void _drawStroke(Canvas canvas, DrawingStroke stroke, Size canvasSize) {
    if (stroke.points.length < 2) return;

    final paint = Paint()
      ..color = _parseColor(stroke.color)
      ..strokeWidth = stroke.width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    if (stroke.tool == 'highlighter') {
      paint.style = PaintingStyle.fill;
      paint.color = paint.color.withOpacity(0.3);
    } else {
      paint.style = PaintingStyle.stroke;
    }

    Path path = Path();
    // Convert first point from PDF coordinates to screen coordinates
    final firstPoint = _denormalizePoint(stroke.points[0], canvasSize);
    path.moveTo(firstPoint.dx, firstPoint.dy);
    
    for (int i = 1; i < stroke.points.length; i++) {
      // Convert each point from PDF coordinates to screen coordinates
      final point = _denormalizePoint(stroke.points[i], canvasSize);
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(path, paint);
  }

  Color _parseColor(String colorString) {
    if (colorString.startsWith('#')) {
      return Color(int.parse(colorString.substring(1), radix: 16) + 0xFF000000);
    }
    return Colors.red;
  }

  @override
  bool shouldRepaint(PdfAnnotationPainter oldDelegate) {
    return oldDelegate.strokes != strokes || oldDelegate.currentStroke != currentStroke;
  }
}

