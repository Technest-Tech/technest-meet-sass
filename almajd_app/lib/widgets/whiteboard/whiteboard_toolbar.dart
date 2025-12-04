/// Whiteboard toolbar widget
/// Provides all drawing tools, color picker, sliders, and controls

import 'package:flutter/material.dart';
import '../../models/whiteboard_models.dart';
import '../../theme/app_colors.dart';
import '../../utils/responsive.dart';
import '../../utils/whiteboard_utils.dart';

class WhiteboardToolbar extends StatefulWidget {
  final ToolType currentTool;
  final Function(ToolType) onToolChange;
  final String currentColor;
  final Function(String) onColorChange;
  final double currentWidth;
  final Function(double) onWidthChange;
  final double currentOpacity;
  final Function(double) onOpacityChange;
  final bool fillShapes;
  final Function(bool) onFillShapesChange;
  final double fontSize;
  final Function(double) onFontSizeChange;
  final String fontFamily;
  final Function(String) onFontFamilyChange;
  final String backgroundColor;
  final Function(String) onBackgroundColorChange;
  final bool showGrid;
  final Function(bool) onShowGridChange;
  final double gridSize;
  final Function(double) onGridSizeChange;
  final double zoom;
  final Function(double) onZoomChange;
  final bool canUndo;
  final bool canRedo;
  final VoidCallback onUndo;
  final VoidCallback onRedo;
  final VoidCallback onClear;
  final VoidCallback onClose;

  const WhiteboardToolbar({
    super.key,
    required this.currentTool,
    required this.onToolChange,
    required this.currentColor,
    required this.onColorChange,
    required this.currentWidth,
    required this.onWidthChange,
    required this.currentOpacity,
    required this.onOpacityChange,
    required this.fillShapes,
    required this.onFillShapesChange,
    required this.fontSize,
    required this.onFontSizeChange,
    required this.fontFamily,
    required this.onFontFamilyChange,
    required this.backgroundColor,
    required this.onBackgroundColorChange,
    required this.showGrid,
    required this.onShowGridChange,
    required this.gridSize,
    required this.onGridSizeChange,
    required this.zoom,
    required this.onZoomChange,
    required this.canUndo,
    required this.canRedo,
    required this.onUndo,
    required this.onRedo,
    required this.onClear,
    required this.onClose,
  });

  @override
  State<WhiteboardToolbar> createState() => _WhiteboardToolbarState();
}

class _WhiteboardToolbarState extends State<WhiteboardToolbar> {
  String _customColor = '';

  static const List<String> _presetColors = [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#FFA500',
    '#800080',
    '#FFC0CB',
    '#A52A2A',
    '#808080',
    '#FFD700',
    '#4B0082',
  ];

  static const List<ToolType> _tools = [
    ToolType.pen,
    ToolType.highlighter,
    ToolType.eraser,
    ToolType.pointer,
    ToolType.text,
  ];

  static const List<ToolType> _shapes = [
    ToolType.line,
    ToolType.arrow,
    ToolType.rectangle,
    ToolType.circle,
    ToolType.ellipse,
    ToolType.triangle,
    ToolType.star,
  ];

  static const List<double> _fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];
  static const List<String> _fontFamilies = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
  ];

  @override
  void initState() {
    super.initState();
    _customColor = widget.currentColor;
  }

  void _handleZoomIn() {
    widget.onZoomChange((widget.zoom + 0.1).clamp(0.1, 3.0));
  }

  void _handleZoomOut() {
    widget.onZoomChange((widget.zoom - 0.1).clamp(0.1, 3.0));
  }

  void _handleZoomReset() {
    widget.onZoomChange(1.0);
  }

  bool _isShapeTool(ToolType tool) {
    return _shapes.contains(tool);
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    final isTablet = Responsive.isTablet(context);

    return Container(
        padding: Responsive.padding(
          context,
          horizontal: Responsive.value(context, phone: 8.0, tablet: 16.0),
          vertical: Responsive.value(context, phone: 8.0, tablet: 12.0),
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withOpacity(0.95),
          border: Border(
            bottom: BorderSide(
              color: AppColors.outline.withOpacity(0.3),
              width: 1,
            ),
          ),
        ),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
            // Close Button
            _buildToolButton(
              icon: Icons.close,
              isActive: false,
              onTap: widget.onClose,
              color: AppColors.danger,
              tooltip: 'Close',
            ),
            const SizedBox(width: 8),

            // Drawing Tools
            _buildToolGroup(
              children: _tools.map((tool) {
                IconData icon;
                String label;
                switch (tool) {
                  case ToolType.pen:
                    icon = Icons.edit;
                    label = 'Pen';
                    break;
                  case ToolType.highlighter:
                    icon = Icons.brush;
                    label = 'Highlighter';
                    break;
                  case ToolType.eraser:
                    icon = Icons.auto_fix_high;
                    label = 'Eraser';
                    break;
                  case ToolType.pointer:
                    icon = Icons.near_me;
                    label = 'Pointer';
                    break;
                  case ToolType.text:
                    icon = Icons.text_fields;
                    label = 'Text';
                    break;
                  default:
                    icon = Icons.edit;
                    label = 'Tool';
                }
                return _buildToolButton(
                  icon: icon,
                  isActive: widget.currentTool == tool,
                  onTap: () => widget.onToolChange(tool),
                  tooltip: label,
                );
              }).toList(),
            ),
            const SizedBox(width: 8),

            // Shapes Dropdown
            _buildToolGroup(
              children: [
                PopupMenuButton<ToolType>(
                  tooltip: 'Shapes',
                  offset: const Offset(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  color: AppColors.surfaceElevated,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _isShapeTool(widget.currentTool)
                          ? AppColors.primary.withOpacity(0.2)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _isShapeTool(widget.currentTool)
                            ? AppColors.primary
                            : AppColors.outline.withOpacity(0.4),
                        width: _isShapeTool(widget.currentTool) ? 2 : 1,
                      ),
                    ),
                    child: Icon(
                      Icons.crop_square,
                      color: _isShapeTool(widget.currentTool)
                          ? AppColors.primary
                          : AppColors.textSecondary,
                      size: 20,
                    ),
                  ),
                  itemBuilder: (context) => _shapes.map((shape) {
                    final isActive = widget.currentTool == shape;
                    return PopupMenuItem<ToolType>(
                      value: shape,
                      child: Row(
                        children: [
                          Icon(
                            _getShapeIcon(shape),
                            size: 18,
                            color: isActive ? AppColors.primary : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _getShapeLabel(shape),
                            style: TextStyle(
                              color: isActive ? AppColors.primary : AppColors.textPrimary,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                  onSelected: (shape) {
                    widget.onToolChange(shape);
                  },
                ),
              ],
            ),
            const SizedBox(width: 8),

            // Separator
            _buildSeparator(),
            const SizedBox(width: 8),

            // Color Picker
            _buildToolGroup(
              children: [
                PopupMenuButton<String>(
                  tooltip: 'Color',
                  offset: const Offset(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  color: AppColors.surfaceElevated,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: hexToColor(widget.currentColor),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.outline,
                        width: 2,
                      ),
                    ),
                  ),
                  itemBuilder: (context) => [
                    PopupMenuItem<String>(
                      enabled: false,
                      child: _buildColorPickerMenu(),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(width: 8),

            // Brush Width - Quick sizes for pen/eraser, slider for others
            if (widget.currentTool == ToolType.pen || widget.currentTool == ToolType.eraser)
              _buildToolGroup(
                children: [
                  _buildSizeButton(
                    size: 3,
                    currentSize: widget.currentWidth,
                    onTap: () => widget.onWidthChange(3),
                    tooltip: 'Small (3px)',
                  ),
                  _buildSizeButton(
                    size: 8,
                    currentSize: widget.currentWidth,
                    onTap: () => widget.onWidthChange(8),
                    tooltip: 'Medium (8px)',
                  ),
                  _buildSizeButton(
                    size: 15,
                    currentSize: widget.currentWidth,
                    onTap: () => widget.onWidthChange(15),
                    tooltip: 'Large (15px)',
                  ),
                ],
              ),
            if (widget.currentTool == ToolType.pen || widget.currentTool == ToolType.eraser)
              const SizedBox(width: 8),
            
            // Brush Width Slider (for other tools)
            if (!isMobile && widget.currentTool != ToolType.pen && widget.currentTool != ToolType.eraser)
              _buildToolGroup(
                children: [
                  SizedBox(
                    width: Responsive.value(context, phone: 100.0, tablet: 120.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.edit, size: 14, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              '${widget.currentWidth.toInt()}px',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        Slider(
                          value: widget.currentWidth,
                          min: 1,
                          max: 50,
                          onChanged: widget.onWidthChange,
                          activeColor: AppColors.primary,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            if (!isMobile && widget.currentTool != ToolType.pen && widget.currentTool != ToolType.eraser)
              const SizedBox(width: 8),

            // Opacity Slider
            if (!isMobile)
              _buildToolGroup(
                children: [
                  SizedBox(
                    width: Responsive.value(context, phone: 100.0, tablet: 120.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.opacity, size: 14, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              '${(widget.currentOpacity * 100).toInt()}%',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        Slider(
                          value: widget.currentOpacity,
                          min: 0,
                          max: 1,
                          divisions: 10,
                          onChanged: widget.onOpacityChange,
                          activeColor: AppColors.primary,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            if (!isMobile) const SizedBox(width: 8),

            // Fill Toggle (for shapes)
            if (_isShapeTool(widget.currentTool))
              _buildToolGroup(
                children: [
                  _buildToolButton(
                    icon: widget.fillShapes ? Icons.check_box : Icons.check_box_outline_blank,
                    isActive: widget.fillShapes,
                    onTap: () => widget.onFillShapesChange(!widget.fillShapes),
                    tooltip: widget.fillShapes ? 'Filled' : 'Outline',
                  ),
                ],
              ),
            if (_isShapeTool(widget.currentTool)) const SizedBox(width: 8),

            // Text Options (when text tool is active)
            if (widget.currentTool == ToolType.text) ...[
              _buildToolGroup(
                children: [
                  SizedBox(
                    width: 80,
                    child: DropdownButton<double>(
                      value: widget.fontSize,
                      isDense: true,
                      items: _fontSizes.map((size) {
                        return DropdownMenuItem(
                          value: size,
                          child: Text('${size.toInt()}px', style: const TextStyle(fontSize: 12)),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value != null) widget.onFontSizeChange(value);
                      },
                      dropdownColor: AppColors.surfaceElevated,
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              _buildToolGroup(
                children: [
                  SizedBox(
                    width: 120,
                    child: DropdownButton<String>(
                      value: widget.fontFamily,
                      isDense: true,
                      items: _fontFamilies.map((family) {
                        return DropdownMenuItem(
                          value: family,
                          child: Text(family, style: const TextStyle(fontSize: 12)),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value != null) widget.onFontFamilyChange(value);
                      },
                      dropdownColor: AppColors.surfaceElevated,
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
            ],

            // Separator
            _buildSeparator(),
            const SizedBox(width: 8),

            // Undo/Redo
            _buildToolGroup(
              children: [
                _buildToolButton(
                  icon: Icons.undo,
                  isActive: false,
                  onTap: widget.canUndo ? widget.onUndo : null,
                  tooltip: 'Undo',
                  isDisabled: !widget.canUndo,
                ),
                _buildToolButton(
                  icon: Icons.redo,
                  isActive: false,
                  onTap: widget.canRedo ? widget.onRedo : null,
                  tooltip: 'Redo',
                  isDisabled: !widget.canRedo,
                ),
              ],
            ),
            const SizedBox(width: 8),

            // Separator
            _buildSeparator(),
            const SizedBox(width: 8),

            // Zoom Controls
            _buildToolGroup(
              children: [
                _buildToolButton(
                  icon: Icons.zoom_out,
                  isActive: false,
                  onTap: _handleZoomOut,
                  tooltip: 'Zoom Out',
                ),
                GestureDetector(
                  onTap: _handleZoomReset,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${(widget.zoom * 100).toInt()}%',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                _buildToolButton(
                  icon: Icons.zoom_in,
                  isActive: false,
                  onTap: _handleZoomIn,
                  tooltip: 'Zoom In',
                ),
              ],
            ),
            const SizedBox(width: 8),

            // Separator
            _buildSeparator(),
            const SizedBox(width: 8),

            // Grid Toggle
            _buildToolGroup(
              children: [
                _buildToolButton(
                  icon: Icons.grid_on,
                  isActive: widget.showGrid,
                  onTap: () => widget.onShowGridChange(!widget.showGrid),
                  tooltip: 'Toggle Grid',
                ),
              ],
            ),
            const SizedBox(width: 8),

            // Separator
            _buildSeparator(),
            const SizedBox(width: 8),

            // Clear Button
            _buildToolGroup(
              children: [
                _buildToolButton(
                  icon: Icons.delete_sweep,
                  isActive: false,
                  onTap: widget.onClear,
                  tooltip: 'Clear All',
                  color: AppColors.warning,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToolGroup({required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted.withOpacity(0.6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppColors.outline.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }

  Widget _buildToolButton({
    required IconData icon,
    required bool isActive,
    required VoidCallback? onTap,
    String? tooltip,
    Color? color,
    bool isDisabled = false,
  }) {
    final buttonColor = color ?? (isActive ? AppColors.primary : AppColors.textSecondary);
    final backgroundColor = isActive
        ? AppColors.primary.withOpacity(0.2)
        : Colors.transparent;

    return Tooltip(
      message: tooltip ?? '',
      child: GestureDetector(
        onTap: isDisabled ? null : onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(8),
            border: isActive
                ? Border.all(color: AppColors.primary, width: 2)
                : null,
          ),
          child: Icon(
            icon,
            color: isDisabled ? AppColors.textMuted : buttonColor,
            size: 20,
          ),
        ),
      ),
    );
  }

  Widget _buildSeparator() {
    return Container(
      width: 1,
      height: 32,
      color: AppColors.outline.withOpacity(0.3),
    );
  }

  Widget _buildSizeButton({
    required double size,
    required double currentSize,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    final isActive = currentSize == size;
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isActive
                ? AppColors.primary.withOpacity(0.2)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isActive
                  ? AppColors.primary
                  : AppColors.outline.withOpacity(0.4),
              width: isActive ? 2 : 1,
            ),
          ),
          child: Center(
            child: Container(
              width: size * 1.5,
              height: size * 1.5,
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : AppColors.textSecondary,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildColorPickerMenu() {
    return Container(
      padding: const EdgeInsets.all(12),
      constraints: const BoxConstraints(minWidth: 200),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Preset colors
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _presetColors.map((color) {
              final isSelected = widget.currentColor == color;
              return GestureDetector(
                onTap: () {
                  widget.onColorChange(color);
                  Navigator.of(context).pop(); // Close popup menu
                },
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: hexToColor(color),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.outline,
                      width: isSelected ? 3 : 1,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          // Custom color picker
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: hexToColor(_customColor),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.outline),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: TextEditingController(text: _customColor),
                  onChanged: (value) {
                    if (value.startsWith('#') && value.length == 7) {
                      setState(() => _customColor = value);
                      widget.onColorChange(value);
                    }
                  },
                  decoration: InputDecoration(
                    hintText: '#000000',
                    hintStyle: TextStyle(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: BorderSide(color: AppColors.outline),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                  ),
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getShapeIcon(ToolType shape) {
    switch (shape) {
      case ToolType.line:
        return Icons.remove;
      case ToolType.arrow:
        return Icons.arrow_forward;
      case ToolType.rectangle:
        return Icons.crop_square;
      case ToolType.circle:
        return Icons.circle_outlined;
      case ToolType.ellipse:
        return Icons.radio_button_unchecked;
      case ToolType.triangle:
        return Icons.change_history;
      case ToolType.star:
        return Icons.star_border;
      default:
        return Icons.crop_square;
    }
  }

  String _getShapeLabel(ToolType shape) {
    switch (shape) {
      case ToolType.line:
        return 'Line';
      case ToolType.arrow:
        return 'Arrow';
      case ToolType.rectangle:
        return 'Rectangle';
      case ToolType.circle:
        return 'Circle';
      case ToolType.ellipse:
        return 'Ellipse';
      case ToolType.triangle:
        return 'Triangle';
      case ToolType.star:
        return 'Star';
      default:
        return 'Shape';
    }
  }

}

