'use client';

import React, { useState } from 'react';
import styles from '../styles/NormalWhiteboard.module.css';
import { ToolType } from './utils/whiteboardUtils';
import {
  Pencil,
  Highlighter,
  Eraser,
  MousePointer2,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Triangle,
  Star,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Palette,
  Settings,
  Image,
  Maximize2,
} from 'lucide-react';

interface NormalWhiteboardToolbarProps {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  currentWidth: number;
  onWidthChange: (width: number) => void;
  currentOpacity: number;
  onOpacityChange: (opacity: number) => void;
  fillShapes: boolean;
  onFillShapesChange: (fill: boolean) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontFamily: string;
  onFontFamilyChange: (family: string) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: (format: 'png' | 'jpg') => void;
  onImportImage: (file: File) => void;
  onClose: () => void;
  onToggleLayers: () => void;
  showLayersPanel: boolean;
}

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#FFD700', '#4B0082',
];

const TOOLS: Array<{ type: ToolType; icon: React.ReactNode; label: string }> = [
  { type: 'pen', icon: <Pencil size={18} />, label: 'Pen' },
  { type: 'highlighter', icon: <Highlighter size={18} />, label: 'Highlighter' },
  { type: 'eraser', icon: <Eraser size={18} />, label: 'Eraser' },
  { type: 'pointer', icon: <MousePointer2 size={18} />, label: 'Pointer' },
  { type: 'text', icon: <Type size={18} />, label: 'Text' },
];

const SHAPES: Array<{ type: ToolType; icon: React.ReactNode; label: string }> = [
  { type: 'line', icon: <Minus size={18} />, label: 'Line' },
  { type: 'arrow', icon: <ArrowRight size={18} />, label: 'Arrow' },
  { type: 'rectangle', icon: <Square size={18} />, label: 'Rectangle' },
  { type: 'circle', icon: <Circle size={18} />, label: 'Circle' },
  { type: 'ellipse', icon: <Circle size={18} />, label: 'Ellipse' },
  { type: 'triangle', icon: <Triangle size={18} />, label: 'Triangle' },
  { type: 'star', icon: <Star size={18} />, label: 'Star' },
];

export function NormalWhiteboardToolbar(props: NormalWhiteboardToolbarProps) {
  const {
    currentTool,
    onToolChange,
    currentColor,
    onColorChange,
    currentWidth,
    onWidthChange,
    currentOpacity,
    onOpacityChange,
    fillShapes,
    onFillShapesChange,
    fontSize,
    onFontSizeChange,
    fontFamily,
    onFontFamilyChange,
    backgroundColor,
    onBackgroundColorChange,
    showGrid,
    onShowGridChange,
    gridSize,
    onGridSizeChange,
    zoom,
    onZoomChange,
    onFitToScreen,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onClear,
    onExport,
    onImportImage,
    onClose,
    onToggleLayers,
    showLayersPanel,
  } = props;

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShapes, setShowShapes] = useState(false);
  const [customColor, setCustomColor] = useState(currentColor);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 0.1, 3));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 0.1, 0.1));
  };

  const handleZoomReset = () => {
    onZoomChange(1);
  };

  return (
    <div className={styles.toolbar}>
      {/* Close Button */}
      <button
        className={`${styles.toolButton} ${styles.closeButton}`}
        onClick={onClose}
        title="Close"
      >
        <X size={20} />
      </button>

      {/* Drawing Tools */}
      <div className={styles.toolGroup}>
        {TOOLS.map(tool => (
          <button
            key={tool.type}
            className={`${styles.toolButton} ${currentTool === tool.type ? styles.active : ''}`}
            onClick={() => onToolChange(tool.type)}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Shapes Dropdown */}
      <div className={styles.toolGroup}>
        <div className={styles.dropdown}>
          <button
            className={`${styles.toolButton} ${SHAPES.some(s => s.type === currentTool) ? styles.active : ''}`}
            onClick={() => setShowShapes(!showShapes)}
            title="Shapes"
          >
            <Square size={18} />
          </button>
          {showShapes && (
            <div className={styles.dropdownMenu}>
              {SHAPES.map(shape => (
                <button
                  key={shape.type}
                  className={`${styles.dropdownItem} ${currentTool === shape.type ? styles.active : ''}`}
                  onClick={() => {
                    onToolChange(shape.type);
                    setShowShapes(false);
                  }}
                  title={shape.label}
                >
                  {shape.icon}
                  <span>{shape.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Color Picker */}
      <div className={styles.toolGroup}>
        <div className={styles.dropdown}>
          <button
            className={styles.colorButton}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Color"
          >
            <div className={styles.colorPreview} style={{ backgroundColor: currentColor }} />
          </button>
          {showColorPicker && (
            <div className={`${styles.dropdownMenu} ${styles.colorPickerMenu}`}>
              <div className={styles.presetColors}>
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    className={`${styles.presetColor} ${currentColor === color ? styles.active : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      onColorChange(color);
                      setCustomColor(color);
                      setShowColorPicker(false);
                    }}
                    title={color}
                  />
                ))}
              </div>
              <div className={styles.customColorPicker}>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    onColorChange(e.target.value);
                  }}
                  className={styles.colorInput}
                />
                <span>Custom Color</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brush Width Slider */}
      <div className={styles.toolGroup}>
        <div className={styles.sliderControl}>
          <label className={styles.sliderLabel}>
            <Pencil size={14} />
            <span>{currentWidth}px</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={currentWidth}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Opacity Slider */}
      <div className={styles.toolGroup}>
        <div className={styles.sliderControl}>
          <label className={styles.sliderLabel}>
            <Palette size={14} />
            <span>{Math.round(currentOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={currentOpacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Fill Toggle (for shapes) */}
      {SHAPES.some(s => s.type === currentTool) && (
        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolButton} ${fillShapes ? styles.active : ''}`}
            onClick={() => onFillShapesChange(!fillShapes)}
            title={fillShapes ? 'Filled' : 'Outline'}
          >
            {fillShapes ? '⬛' : '⬜'}
          </button>
        </div>
      )}

      {/* Text Options (when text tool is active) */}
      {currentTool === 'text' && (
        <>
          <div className={styles.toolGroup}>
            <select
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className={styles.select}
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
          <div className={styles.toolGroup}>
            <select
              value={fontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
              className={styles.select}
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
          </div>
        </>
      )}

      {/* Separator */}
      <div className={styles.separator} />

      {/* Undo/Redo */}
      <div className={styles.toolGroup}>
        <button
          className={styles.toolButton}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Zoom Controls */}
      <div className={styles.toolGroup}>
        <button
          className={styles.toolButton}
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          className={styles.zoomDisplay}
          onClick={handleZoomReset}
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className={styles.toolButton}
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        {onFitToScreen && (
          <button
            className={styles.toolButton}
            onClick={onFitToScreen}
            title="Fit to Screen"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Grid Toggle */}
      <div className={styles.toolGroup}>
        <button
          className={`${styles.toolButton} ${showGrid ? styles.active : ''}`}
          onClick={() => onShowGridChange(!showGrid)}
          title="Toggle Grid"
        >
          <Grid3x3 size={18} />
        </button>
      </div>

      {/* Layers Toggle */}
      <div className={styles.toolGroup}>
        <button
          className={`${styles.toolButton} ${showLayersPanel ? styles.active : ''}`}
          onClick={onToggleLayers}
          title="Toggle Layers"
        >
          <Layers size={18} />
        </button>
      </div>

      {/* Settings Dropdown */}
      <div className={styles.toolGroup}>
        <div className={styles.dropdown}>
          <button
            className={`${styles.toolButton} ${showSettings ? styles.active : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          {showSettings && (
            <div className={`${styles.dropdownMenu} ${styles.settingsMenu}`}>
              <div className={styles.settingItem}>
                <label>Background Color</label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => onBackgroundColorChange(e.target.value)}
                  className={styles.colorInput}
                />
              </div>
              {showGrid && (
                <div className={styles.settingItem}>
                  <label>Grid Size: {gridSize}px</label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={gridSize}
                    onChange={(e) => onGridSizeChange(Number(e.target.value))}
                    className={styles.slider}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Action Buttons */}
      <div className={styles.toolGroup}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportImage(file);
              e.target.value = '';
            }
          }}
          style={{ display: 'none' }}
        />
        <button
          className={styles.toolButton}
          onClick={() => imageInputRef.current?.click()}
          title="Import Image"
        >
          <Image size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={onClear}
          title="Clear All"
        >
          <Trash2 size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={() => onExport('png')}
          title="Export as PNG"
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
}

