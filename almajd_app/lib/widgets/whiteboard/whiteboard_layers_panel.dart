/// Whiteboard layers panel widget
/// Manages layer visibility, locking, opacity, and reordering

import 'package:flutter/material.dart';
import '../../models/whiteboard_models.dart';
import '../../theme/app_colors.dart';
import '../../utils/whiteboard_utils.dart';

class WhiteboardLayersPanel extends StatefulWidget {
  final List<Layer> layers;
  final String activeLayerId;
  final Function(List<Layer>) onLayersChange;
  final Function(String) onActiveLayerChange;

  const WhiteboardLayersPanel({
    super.key,
    required this.layers,
    required this.activeLayerId,
    required this.onLayersChange,
    required this.onActiveLayerChange,
  });

  @override
  State<WhiteboardLayersPanel> createState() => _WhiteboardLayersPanelState();
}

class _WhiteboardLayersPanelState extends State<WhiteboardLayersPanel> {
  String? _editingLayerId;
  String _editingName = '';
  final TextEditingController _nameController = TextEditingController();

  void _handleAddLayer() {
    final newLayer = Layer(
      id: generateId(),
      name: 'Layer ${widget.layers.length + 1}',
      visible: true,
      locked: false,
      opacity: 1.0,
      zIndex: widget.layers.length,
    );
    widget.onLayersChange([...widget.layers, newLayer]);
    widget.onActiveLayerChange(newLayer.id);
  }

  void _handleDeleteLayer(String layerId) {
    if (widget.layers.length == 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot delete the last layer')),
      );
      return;
    }

    final newLayers = widget.layers.where((l) => l.id != layerId).toList();
    widget.onLayersChange(newLayers);

    if (layerId == widget.activeLayerId) {
      widget.onActiveLayerChange(newLayers[0].id);
    }
  }

  void _handleDuplicateLayer(String layerId) {
    final layer = widget.layers.firstWhere((l) => l.id == layerId);
    final newLayer = layer.copyWith(
      id: generateId(),
      name: '${layer.name} Copy',
      zIndex: widget.layers.length,
    );
    widget.onLayersChange([...widget.layers, newLayer]);
  }

  void _handleToggleVisibility(String layerId) {
    final newLayers = widget.layers.map((l) {
      if (l.id == layerId) {
        return l.copyWith(visible: !l.visible);
      }
      return l;
    }).toList();
    widget.onLayersChange(newLayers);
  }

  void _handleToggleLock(String layerId) {
    final newLayers = widget.layers.map((l) {
      if (l.id == layerId) {
        return l.copyWith(locked: !l.locked);
      }
      return l;
    }).toList();
    widget.onLayersChange(newLayers);
  }

  void _handleOpacityChange(String layerId, double opacity) {
    final newLayers = widget.layers.map((l) {
      if (l.id == layerId) {
        return l.copyWith(opacity: opacity);
      }
      return l;
    }).toList();
    widget.onLayersChange(newLayers);
  }

  void _handleMoveUp(String layerId) {
    final index = widget.layers.indexWhere((l) => l.id == layerId);
    if (index == widget.layers.length - 1) return;

    final newLayers = List<Layer>.from(widget.layers);
    final temp = newLayers[index];
    newLayers[index] = newLayers[index + 1];
    newLayers[index + 1] = temp;

    // Update z-indices
    for (int i = 0; i < newLayers.length; i++) {
      newLayers[i] = newLayers[i].copyWith(zIndex: i);
    }

    widget.onLayersChange(newLayers);
  }

  void _handleMoveDown(String layerId) {
    final index = widget.layers.indexWhere((l) => l.id == layerId);
    if (index == 0) return;

    final newLayers = List<Layer>.from(widget.layers);
    final temp = newLayers[index];
    newLayers[index] = newLayers[index - 1];
    newLayers[index - 1] = temp;

    // Update z-indices
    for (int i = 0; i < newLayers.length; i++) {
      newLayers[i] = newLayers[i].copyWith(zIndex: i);
    }

    widget.onLayersChange(newLayers);
  }

  void _handleStartRename(Layer layer) {
    setState(() {
      _editingLayerId = layer.id;
      _editingName = layer.name;
      _nameController.text = layer.name;
    });
  }

  void _handleFinishRename() {
    if (_editingLayerId != null && _editingName.trim().isNotEmpty) {
      final newLayers = widget.layers.map((l) {
        if (l.id == _editingLayerId) {
          return l.copyWith(name: _editingName.trim());
        }
        return l;
      }).toList();
      widget.onLayersChange(newLayers);
    }
    setState(() {
      _editingLayerId = null;
      _editingName = '';
      _nameController.clear();
    });
  }

  void _handleCancelRename() {
    setState(() {
      _editingLayerId = null;
      _editingName = '';
      _nameController.clear();
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        border: Border(
          left: BorderSide(
            color: AppColors.outline.withOpacity(0.3),
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppColors.outline.withOpacity(0.3),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Layers',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  color: AppColors.textPrimary,
                  onPressed: _handleAddLayer,
                  tooltip: 'Add Layer',
                ),
              ],
            ),
          ),

          // Layers List
          Expanded(
            child: ListView.builder(
              reverse: true, // Show top layer first
              itemCount: widget.layers.length,
              itemBuilder: (context, index) {
                final layer = widget.layers[widget.layers.length - 1 - index];
                final isActive = layer.id == widget.activeLayerId;
                final isEditing = _editingLayerId == layer.id;
                final layerIndex = widget.layers.indexOf(layer);

                return InkWell(
                  onTap: layer.locked ? null : () => widget.onActiveLayerChange(layer.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isActive
                          ? AppColors.primary.withOpacity(0.2)
                          : Colors.transparent,
                      border: isActive
                          ? Border(
                              left: BorderSide(
                                color: AppColors.primary,
                                width: 3,
                              ),
                            )
                          : null,
                    ),
                    child: Column(
                      children: [
                        // Layer name and opacity
                        Row(
                          children: [
                            Expanded(
                              child: isEditing
                                  ? TextField(
                                      controller: _nameController,
                                      autofocus: true,
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 14,
                                      ),
                                      decoration: InputDecoration(
                                        isDense: true,
                                        contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(4),
                                          borderSide: BorderSide(
                                            color: AppColors.outline,
                                          ),
                                        ),
                                        filled: true,
                                        fillColor: AppColors.surfaceMuted,
                                      ),
                                      onSubmitted: (_) => _handleFinishRename(),
                                      onEditingComplete: _handleFinishRename,
                                    )
                                  : GestureDetector(
                                      onDoubleTap: () => _handleStartRename(layer),
                                      child: Text(
                                        layer.name,
                                        style: TextStyle(
                                          color: layer.locked
                                              ? AppColors.textMuted
                                              : AppColors.textPrimary,
                                          fontSize: 14,
                                          fontWeight: isActive
                                              ? FontWeight.w600
                                              : FontWeight.normal,
                                        ),
                                      ),
                                    ),
                            ),
                            Text(
                              '${(layer.opacity * 100).toInt()}%',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),

                        // Opacity slider
                        Slider(
                          value: layer.opacity,
                          min: 0,
                          max: 1,
                          divisions: 10,
                          onChanged: (value) => _handleOpacityChange(layer.id, value),
                          activeColor: AppColors.primary,
                        ),

                        // Layer actions
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            // Visibility toggle
                            IconButton(
                              icon: Icon(
                                layer.visible ? Icons.visibility : Icons.visibility_off,
                                size: 18,
                              ),
                              color: AppColors.textSecondary,
                              onPressed: () => _handleToggleVisibility(layer.id),
                              tooltip: layer.visible ? 'Hide' : 'Show',
                            ),

                            // Lock toggle
                            IconButton(
                              icon: Icon(
                                layer.locked ? Icons.lock : Icons.lock_open,
                                size: 18,
                              ),
                              color: AppColors.textSecondary,
                              onPressed: () => _handleToggleLock(layer.id),
                              tooltip: layer.locked ? 'Unlock' : 'Lock',
                            ),

                            // Move up
                            IconButton(
                              icon: const Icon(Icons.keyboard_arrow_up, size: 18),
                              color: layerIndex == widget.layers.length - 1
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary,
                              onPressed: layerIndex == widget.layers.length - 1
                                  ? null
                                  : () => _handleMoveUp(layer.id),
                              tooltip: 'Move Up',
                            ),

                            // Move down
                            IconButton(
                              icon: const Icon(Icons.keyboard_arrow_down, size: 18),
                              color: layerIndex == 0
                                  ? AppColors.textMuted
                                  : AppColors.textSecondary,
                              onPressed: layerIndex == 0
                                  ? null
                                  : () => _handleMoveDown(layer.id),
                              tooltip: 'Move Down',
                            ),

                            // Duplicate
                            IconButton(
                              icon: const Icon(Icons.copy, size: 18),
                              color: AppColors.textSecondary,
                              onPressed: () => _handleDuplicateLayer(layer.id),
                              tooltip: 'Duplicate',
                            ),

                            // Delete
                            IconButton(
                              icon: const Icon(Icons.delete, size: 18),
                              color: widget.layers.length == 1
                                  ? AppColors.textMuted
                                  : AppColors.danger,
                              onPressed: widget.layers.length == 1
                                  ? null
                                  : () {
                                      showDialog(
                                        context: context,
                                        builder: (context) => AlertDialog(
                                          title: const Text('Delete Layer'),
                                          content: Text(
                                            'Delete layer "${layer.name}"?',
                                          ),
                                          actions: [
                                            TextButton(
                                              onPressed: () => Navigator.pop(context),
                                              child: const Text('Cancel'),
                                            ),
                                            TextButton(
                                              onPressed: () {
                                                _handleDeleteLayer(layer.id);
                                                Navigator.pop(context);
                                              },
                                              child: Text(
                                                'Delete',
                                                style: TextStyle(color: AppColors.danger),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                              tooltip: 'Delete',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

