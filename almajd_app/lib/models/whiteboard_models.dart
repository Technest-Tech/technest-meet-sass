import 'dart:ui';

/// Whiteboard data models matching web implementation
/// These models ensure compatibility with the web collaborative whiteboard

/// Tool types available in the whiteboard
enum ToolType {
  pen,
  highlighter,
  eraser,
  pointer,
  text,
  rectangle,
  circle,
  ellipse,
  line,
  arrow,
  triangle,
  star;

  /// Convert to string for JSON serialization
  String toJson() => name;

  /// Create from string (for JSON deserialization)
  static ToolType fromJson(String value) {
    return ToolType.values.firstWhere(
      (e) => e.name == value,
      orElse: () => ToolType.pen,
    );
  }
}

/// Point on the canvas
class Point {
  final double x;
  final double y;

  Point({required this.x, required this.y});

  /// Convert to JSON
  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  /// Create from JSON
  factory Point.fromJson(Map<String, dynamic> json) {
    return Point(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
    );
  }

  /// Create from Offset
  factory Point.fromOffset(Offset offset) {
    return Point(x: offset.dx, y: offset.dy);
  }

  /// Convert to Offset
  Offset toOffset() => Offset(x, y);

  @override
  String toString() => 'Point($x, $y)';
}

/// Image size for image actions
class ImageSize {
  final double width;
  final double height;

  ImageSize({required this.width, required this.height});

  /// Convert to JSON
  Map<String, dynamic> toJson() => {'width': width, 'height': height};

  /// Create from JSON
  factory ImageSize.fromJson(Map<String, dynamic> json) {
    return ImageSize(
      width: (json['width'] as num).toDouble(),
      height: (json['height'] as num).toDouble(),
    );
  }
}

/// Shape types for shape actions
enum ShapeType {
  rectangle,
  circle,
  ellipse,
  line,
  arrow,
  triangle,
  star;

  String toJson() => name;

  static ShapeType fromJson(String value) {
    return ShapeType.values.firstWhere(
      (e) => e.name == value,
      orElse: () => ShapeType.rectangle,
    );
  }
}

/// Action types
enum ActionType {
  stroke,
  shape,
  text,
  image;

  String toJson() => name;

  static ActionType fromJson(String value) {
    return ActionType.values.firstWhere(
      (e) => e.name == value,
      orElse: () => ActionType.stroke,
    );
  }
}

/// Drawing action - represents a single drawing operation
class DrawAction {
  final String id;
  final ActionType type;
  final ToolType tool;
  final List<Point>? points;
  final String color;
  final double width;
  final double opacity;
  final bool? fill;
  final String? text;
  final double? fontSize;
  final String? fontFamily;
  final String layerId;
  final ShapeType? shapeType;
  final Point? startPoint;
  final Point? endPoint;
  final String? imageData;
  final Point? imagePosition;
  final ImageSize? imageSize;

  DrawAction({
    required this.id,
    required this.type,
    required this.tool,
    this.points,
    required this.color,
    required this.width,
    required this.opacity,
    this.fill,
    this.text,
    this.fontSize,
    this.fontFamily,
    required this.layerId,
    this.shapeType,
    this.startPoint,
    this.endPoint,
    this.imageData,
    this.imagePosition,
    this.imageSize,
  });

  /// Convert to JSON for transmission
  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{
      'id': id,
      'type': type.toJson(),
      'tool': tool.toJson(),
      'color': color,
      'width': width,
      'opacity': opacity,
      'layerId': layerId,
    };

    if (points != null) {
      json['points'] = points!.map((p) => p.toJson()).toList();
    }
    if (fill != null) json['fill'] = fill;
    if (text != null) json['text'] = text;
    if (fontSize != null) json['fontSize'] = fontSize;
    if (fontFamily != null) json['fontFamily'] = fontFamily;
    if (shapeType != null) json['shapeType'] = shapeType!.toJson();
    if (startPoint != null) json['startPoint'] = startPoint!.toJson();
    if (endPoint != null) json['endPoint'] = endPoint!.toJson();
    if (imageData != null) json['imageData'] = imageData;
    if (imagePosition != null) json['imagePosition'] = imagePosition!.toJson();
    if (imageSize != null) json['imageSize'] = imageSize!.toJson();

    return json;
  }

  /// Create from JSON
  factory DrawAction.fromJson(Map<String, dynamic> json) {
    List<Point>? points;
    if (json['points'] != null) {
      points = (json['points'] as List)
          .map((p) => Point.fromJson(p as Map<String, dynamic>))
          .toList();
    }

    return DrawAction(
      id: json['id'] as String,
      type: ActionType.fromJson(json['type'] as String),
      tool: ToolType.fromJson(json['tool'] as String),
      points: points,
      color: json['color'] as String,
      width: (json['width'] as num).toDouble(),
      opacity: (json['opacity'] as num).toDouble(),
      fill: json['fill'] as bool?,
      text: json['text'] as String?,
      fontSize: json['fontSize'] != null ? (json['fontSize'] as num).toDouble() : null,
      fontFamily: json['fontFamily'] as String?,
      layerId: json['layerId'] as String,
      shapeType: json['shapeType'] != null
          ? ShapeType.fromJson(json['shapeType'] as String)
          : null,
      startPoint: json['startPoint'] != null
          ? Point.fromJson(json['startPoint'] as Map<String, dynamic>)
          : null,
      endPoint: json['endPoint'] != null
          ? Point.fromJson(json['endPoint'] as Map<String, dynamic>)
          : null,
      imageData: json['imageData'] as String?,
      imagePosition: json['imagePosition'] != null
          ? Point.fromJson(json['imagePosition'] as Map<String, dynamic>)
          : null,
      imageSize: json['imageSize'] != null
          ? ImageSize.fromJson(json['imageSize'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Create a copy with modified fields
  DrawAction copyWith({
    String? id,
    ActionType? type,
    ToolType? tool,
    List<Point>? points,
    String? color,
    double? width,
    double? opacity,
    bool? fill,
    String? text,
    double? fontSize,
    String? fontFamily,
    String? layerId,
    ShapeType? shapeType,
    Point? startPoint,
    Point? endPoint,
    String? imageData,
    Point? imagePosition,
    ImageSize? imageSize,
  }) {
    return DrawAction(
      id: id ?? this.id,
      type: type ?? this.type,
      tool: tool ?? this.tool,
      points: points ?? this.points,
      color: color ?? this.color,
      width: width ?? this.width,
      opacity: opacity ?? this.opacity,
      fill: fill ?? this.fill,
      text: text ?? this.text,
      fontSize: fontSize ?? this.fontSize,
      fontFamily: fontFamily ?? this.fontFamily,
      layerId: layerId ?? this.layerId,
      shapeType: shapeType ?? this.shapeType,
      startPoint: startPoint ?? this.startPoint,
      endPoint: endPoint ?? this.endPoint,
      imageData: imageData ?? this.imageData,
      imagePosition: imagePosition ?? this.imagePosition,
      imageSize: imageSize ?? this.imageSize,
    );
  }
}

/// Layer for organizing drawing actions
class Layer {
  final String id;
  final String name;
  final bool visible;
  final bool locked;
  final double opacity;
  final int zIndex;

  Layer({
    required this.id,
    required this.name,
    required this.visible,
    required this.locked,
    required this.opacity,
    required this.zIndex,
  });

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'visible': visible,
      'locked': locked,
      'opacity': opacity,
      'zIndex': zIndex,
    };
  }

  /// Create from JSON
  factory Layer.fromJson(Map<String, dynamic> json) {
    return Layer(
      id: json['id'] as String,
      name: json['name'] as String,
      visible: json['visible'] as bool,
      locked: json['locked'] as bool,
      opacity: (json['opacity'] as num).toDouble(),
      zIndex: json['zIndex'] as int,
    );
  }

  /// Create a copy with modified fields
  Layer copyWith({
    String? id,
    String? name,
    bool? visible,
    bool? locked,
    double? opacity,
    int? zIndex,
  }) {
    return Layer(
      id: id ?? this.id,
      name: name ?? this.name,
      visible: visible ?? this.visible,
      locked: locked ?? this.locked,
      opacity: opacity ?? this.opacity,
      zIndex: zIndex ?? this.zIndex,
    );
  }
}

