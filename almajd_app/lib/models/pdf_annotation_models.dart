import 'dart:convert';

/// Drawing point with x, y coordinates and optional pressure
class DrawingPoint {
  final double x;
  final double y;
  final double? pressure;

  DrawingPoint({
    required this.x,
    required this.y,
    this.pressure,
  });

  Map<String, dynamic> toJson() => {
        'x': x,
        'y': y,
        if (pressure != null) 'pressure': pressure,
      };

  factory DrawingPoint.fromJson(Map<String, dynamic> json) => DrawingPoint(
        x: (json['x'] as num?)?.toDouble() ?? 0.0,
        y: (json['y'] as num?)?.toDouble() ?? 0.0,
        pressure: (json['pressure'] as num?)?.toDouble(),
      );
}

/// Drawing stroke containing multiple points
class DrawingStroke {
  final String id;
  final List<DrawingPoint> points;
  final String color;
  final double width;
  final String tool; // 'pen', 'highlighter', 'eraser', 'pointer'
  final String? sender; // Track which participant created the stroke

  DrawingStroke({
    required this.id,
    required this.points,
    required this.color,
    required this.width,
    required this.tool,
    this.sender,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'points': points.map((p) => p.toJson()).toList(),
        'color': color,
        'width': width,
        'tool': tool,
        if (sender != null) 'sender': sender,
      };

  factory DrawingStroke.fromJson(Map<String, dynamic> json) => DrawingStroke(
        id: json['id'] as String? ?? '',
        points: (json['points'] as List?)
                ?.map((p) => DrawingPoint.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [],
        color: json['color'] as String? ?? '#FF0000',
        width: (json['width'] as num?)?.toDouble() ?? 4.0,
        tool: json['tool'] as String? ?? 'pen',
        sender: json['sender'] as String?,
      );
}

/// PDF annotation data for real-time synchronization
class PdfAnnotationData {
  final String type; // 'pdf_annotation_stroke' | 'pdf_annotation_clear' | 'pdf_annotation_delete_host' | 'pdf_annotation_delete_guest' | 'pdf_annotation_delete_all' | 'pdf_viewer_open' | 'pdf_viewer_close' | 'pdf_page_change' | 'pdf_scroll_sync' | 'pdf_prevent_guest_drawing'
  final String fileId;
  final int pageNumber;
  final DrawingStroke? stroke;
  final String sender;
  final int timestamp;
  final String id;
  final bool? isHost;
  final Map<String, dynamic>? file; // For opening PDF
  final double? scrollTop; // For scroll synchronization
  final double? scrollLeft; // For horizontal scroll
  final bool? preventGuestDrawing; // For guest drawing restriction state

  PdfAnnotationData({
    required this.type,
    required this.fileId,
    required this.pageNumber,
    this.stroke,
    required this.sender,
    required this.timestamp,
    required this.id,
    this.isHost,
    this.file,
    this.scrollTop,
    this.scrollLeft,
    this.preventGuestDrawing,
  });

  Map<String, dynamic> toJson() => {
        'type': type,
        'fileId': fileId,
        'pageNumber': pageNumber,
        if (stroke != null) 'stroke': stroke!.toJson(),
        'sender': sender,
        'timestamp': timestamp,
        'id': id,
        if (isHost != null) 'isHost': isHost,
        if (file != null) 'file': file,
        if (scrollTop != null) 'scrollTop': scrollTop,
        if (scrollLeft != null) 'scrollLeft': scrollLeft,
        if (preventGuestDrawing != null) 'preventGuestDrawing': preventGuestDrawing,
      };

  factory PdfAnnotationData.fromJson(Map<String, dynamic> json) => PdfAnnotationData(
        type: json['type'] as String? ?? '',
        fileId: json['fileId'] as String? ?? '',
        pageNumber: json['pageNumber'] as int? ?? 1,
        stroke: json['stroke'] != null
            ? DrawingStroke.fromJson(json['stroke'] as Map<String, dynamic>)
            : null,
        sender: json['sender'] as String? ?? '',
        timestamp: json['timestamp'] as int? ?? 0,
        id: json['id'] as String? ?? '',
        isHost: json['isHost'] as bool?,
        file: json['file'] as Map<String, dynamic>?,
        scrollTop: (json['scrollTop'] as num?)?.toDouble(),
        scrollLeft: (json['scrollLeft'] as num?)?.toDouble(),
        preventGuestDrawing: json['preventGuestDrawing'] as bool?,
      );
}

/// Room file model for file sharing
class RoomFile {
  final String id;
  final String roomId;
  final String filename;
  final String originalName;
  final String fileType;
  final int size;
  final String uploadedBy;
  final int uploadedAt;

  RoomFile({
    required this.id,
    required this.roomId,
    required this.filename,
    required this.originalName,
    required this.fileType,
    required this.size,
    required this.uploadedBy,
    required this.uploadedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'roomId': roomId,
        'filename': filename,
        'originalName': originalName,
        'fileType': fileType,
        'size': size,
        'uploadedBy': uploadedBy,
        'uploadedAt': uploadedAt,
      };

  factory RoomFile.fromJson(Map<String, dynamic> json) => RoomFile(
        id: json['id'] as String? ?? '',
        roomId: json['roomId'] as String? ?? '',
        filename: json['filename'] as String? ?? '',
        originalName: json['originalName'] as String? ?? '',
        fileType: json['fileType'] as String? ?? '',
        size: json['size'] as int? ?? 0,
        uploadedBy: json['uploadedBy'] as String? ?? '',
        uploadedAt: json['uploadedAt'] as int? ?? 0,
      );
}

