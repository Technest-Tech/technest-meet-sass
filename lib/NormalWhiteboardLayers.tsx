'use client';

import React, { useState } from 'react';
import styles from '../styles/NormalWhiteboard.module.css';
import { Layer, generateId } from './utils/whiteboardUtils';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface NormalWhiteboardLayersProps {
  layers: Layer[];
  activeLayerId: string;
  onLayersChange: (layers: Layer[]) => void;
  onActiveLayerChange: (layerId: string) => void;
}

export function NormalWhiteboardLayers({
  layers,
  activeLayerId,
  onLayersChange,
  onActiveLayerChange,
}: NormalWhiteboardLayersProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddLayer = () => {
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: layers.length,
    };
    onLayersChange([...layers, newLayer]);
    onActiveLayerChange(newLayer.id);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length === 1) {
      alert('Cannot delete the last layer');
      return;
    }
    
    const newLayers = layers.filter(l => l.id !== layerId);
    onLayersChange(newLayers);
    
    if (layerId === activeLayerId) {
      onActiveLayerChange(newLayers[0].id);
    }
  };

  const handleDuplicateLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const newLayer: Layer = {
      ...layer,
      id: generateId(),
      name: `${layer.name} Copy`,
      zIndex: layers.length,
    };
    onLayersChange([...layers, newLayer]);
  };

  const handleToggleVisibility = (layerId: string) => {
    const newLayers = layers.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    onLayersChange(newLayers);
  };

  const handleToggleLock = (layerId: string) => {
    const newLayers = layers.map(l =>
      l.id === layerId ? { ...l, locked: !l.locked } : l
    );
    onLayersChange(newLayers);
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    const newLayers = layers.map(l =>
      l.id === layerId ? { ...l, opacity } : l
    );
    onLayersChange(newLayers);
  };

  const handleMoveUp = (layerId: string) => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index === layers.length - 1) return;

    const newLayers = [...layers];
    const temp = newLayers[index];
    newLayers[index] = newLayers[index + 1];
    newLayers[index + 1] = temp;

    // Update z-indices
    newLayers.forEach((layer, i) => {
      layer.zIndex = i;
    });

    onLayersChange(newLayers);
  };

  const handleMoveDown = (layerId: string) => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index === 0) return;

    const newLayers = [...layers];
    const temp = newLayers[index];
    newLayers[index] = newLayers[index - 1];
    newLayers[index - 1] = temp;

    // Update z-indices
    newLayers.forEach((layer, i) => {
      layer.zIndex = i;
    });

    onLayersChange(newLayers);
  };

  const handleStartRename = (layer: Layer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const handleFinishRename = () => {
    if (editingLayerId && editingName.trim()) {
      const newLayers = layers.map(l =>
        l.id === editingLayerId ? { ...l, name: editingName.trim() } : l
      );
      onLayersChange(newLayers);
    }
    setEditingLayerId(null);
    setEditingName('');
  };

  return (
    <div className={styles.layersPanel}>
      <div className={styles.layersPanelHeader}>
        <h3>Layers</h3>
        <button
          className={styles.layerActionButton}
          onClick={handleAddLayer}
          title="Add Layer"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className={styles.layersList}>
        {[...layers].reverse().map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingLayerId === layer.id;

          return (
            <div
              key={layer.id}
              className={`${styles.layerItem} ${isActive ? styles.active : ''} ${layer.locked ? styles.locked : ''}`}
              onClick={() => !layer.locked && onActiveLayerChange(layer.id)}
            >
              <div className={styles.layerMain}>
                <div className={styles.layerInfo}>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleFinishRename();
                        } else if (e.key === 'Escape') {
                          setEditingLayerId(null);
                          setEditingName('');
                        }
                      }}
                      autoFocus
                      className={styles.layerNameInput}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className={styles.layerName}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(layer);
                      }}
                    >
                      {layer.name}
                    </div>
                  )}
                  <div className={styles.layerOpacity}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={layer.opacity}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleOpacityChange(layer.id, Number(e.target.value));
                      }}
                      className={styles.opacitySlider}
                      onClick={(e) => e.stopPropagation()}
                      title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                    />
                    <span className={styles.opacityValue}>
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                </div>

                <div className={styles.layerActions}>
                  <button
                    className={styles.layerActionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(layer.id);
                    }}
                    title={layer.visible ? 'Hide' : 'Show'}
                  >
                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>

                  <button
                    className={styles.layerActionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLock(layer.id);
                    }}
                    title={layer.locked ? 'Unlock' : 'Lock'}
                  >
                    {layer.locked ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>

                  <div className={styles.layerMoveButtons}>
                    <button
                      className={styles.layerActionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(layer.id);
                      }}
                      disabled={layers.indexOf(layer) === layers.length - 1}
                      title="Move Up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      className={styles.layerActionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(layer.id);
                      }}
                      disabled={layers.indexOf(layer) === 0}
                      title="Move Down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  <button
                    className={styles.layerActionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateLayer(layer.id);
                    }}
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>

                  <button
                    className={`${styles.layerActionButton} ${styles.deleteButton}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete layer "${layer.name}"?`)) {
                        handleDeleteLayer(layer.id);
                      }
                    }}
                    title="Delete"
                    disabled={layers.length === 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

