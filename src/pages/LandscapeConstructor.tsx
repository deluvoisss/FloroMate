import React, { useState, useRef, useEffect } from 'react';
import '../types/App1.css';
import { Viewport3D } from './Viewport3D.tsx';

import { clearModelCache } from './Viewport3D.tsx';


interface SceneObject {
  id: string;                    // ID объекта на сцене
  libraryId: string;             // ← НОВОЕ! ID из LIBRARY
  type: 'plant' | 'furniture' | 'doors';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  icon: string;
  useNativeColor?: boolean;
  colorChanged?: boolean;  // ← ДОБАВИТЬ
  scaleX?: number;         // ← ДОБАВИТЬ ДЛЯ МАСШТАБИРОВАНИЯ
  scaleY?: number;
}

interface Project {
  id: string;
  name: string;
  objects: SceneObject[];
  backgroundColor: string;
  gridSize: number;
  groundType: 'grass' | 'asphalt' | 'sand' | 'soil' | 'water';
  showGrid: boolean;
}

interface LibraryItem {
  id: string;
  name: string;
  type: 'plant' | 'furniture' | 'doors';
  icon: string;
  color?: string;
  width: number;
  height: number;
}


const imageCache = new Map<string, HTMLImageElement>();

const getImage = (src: string): HTMLImageElement | null => {
  if (!imageCache.has(src)) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  const img = imageCache.get(src)!;
  return img.complete ? img : null;
};

const LIBRARY: LibraryItem[] = [
  { id: 'p5', name: 'деревья', type: 'plant', icon: 'http://147.45.184.57/images3D/home3.png', width: 80, height: 80 },

  { id: 'f_home', name: 'коттедж', type: 'furniture', icon: 'http://147.45.184.57/images3D/home.png', width: 150, height: 150 },
  { id: 'f_home2', name: 'дом', type: 'furniture', icon: 'http://147.45.184.57/images3D/home2.png', width: 200, height: 200 },
  { id: 'f_home3', name: 'дом', type: 'furniture', icon: 'http://147.45.184.57/images3D/tree.png', width: 250, height: 250 },

  { id: 'amh', name: 'дом', type: 'furniture', icon: 'http://147.45.184.57/images3D/amho.png', width: 80, height: 80 },
  { id: 'asd', name: 'ферма', type: 'furniture', icon: 'http://147.45.184.57/images3D/asd.png', width: 70, height: 70 },
  { id: 'barn', name: 'ферма', type: 'furniture', icon: 'http://147.45.184.57/images3D/barn.png', width: 120, height: 100 },
  { id: 'fenc1', name: 'ворота', type: 'doors', icon: 'http://147.45.184.57/images3D/fenc.png', width: 150, height: 30 },
  { id: 'fence1', name: 'ворота', type: 'doors', icon: 'http://147.45.184.57/images3D/fence.png', width: 150, height: 30 },
  { id: 'fence2', name: 'ворота', type: 'doors', icon: 'http://147.45.184.57/images3D/fences.png', width: 200, height: 30 },
  { id: 'fence3', name: 'ворота', type: 'doors', icon: 'http://147.45.184.57/images3D/fencess.png', width: 200, height: 30 },
  { id: 'flow', name: 'клумба', type: 'plant', icon: 'http://147.45.184.57/images3D/flow.png', width: 50, height: 50 },
  { id: 'poly', name: 'клумба', type: 'plant', icon: 'http://147.45.184.57/images3D/poly.png', width: 90, height: 90 },
  { id: 'qwe', name: 'дом', type: 'furniture', icon: 'http://147.45.184.57/images3D/qwe.png', width: 100, height: 100 },
];

const AI_STYLES = [
  { id: 'modern', name: 'Современный', emoji: '🏢' },
  { id: 'japanese', name: 'Японский', emoji: '🏯' },
  { id: 'minimalist', name: 'Минимализм', emoji: '⬜' },
  { id: 'rustic', name: 'Деревенский', emoji: '🌾' },
  { id: 'tropical', name: 'Тропический', emoji: '🌴' },
];

const Editor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [activeTool, setActiveTool] = useState<'move' | 'scale' | null>(null);
  // Функция для точного получения координат мыши с учетом масштаба CSS
  const getCanvasCoordinates = (e: React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;   // Коэффициент масштаба X
    const scaleY = canvas.height / rect.height; // Коэффициент масштаба Y

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };


  const [project, setProject] = useState<Project>({
    id: Date.now().toString(),
    name: 'Проект',
    objects: [],
    backgroundColor: '#e8f5e9',
    gridSize: 40,
    groundType: 'grass',
    showGrid: true,
  });

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [draggedLibraryItem, setDraggedLibraryItem] = useState<LibraryItem | null>(null);
  const [has3DChanges, setHas3DChanges] = useState(false);
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('modern');
  const [is3D, setIs3D] = useState(false);
  const [history, setHistory] = useState<Project[]>([project]);
  const [lastSyncedObjects, setLastSyncedObjects] = useState<SceneObject[]>([]);

  // 🔧 НОВЫЕ ПЕРЕМЕННЫЕ для отличия клика от перетаскивания
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [movedDistance, setMovedDistance] = useState(0);


  useEffect(() => {
  return () => {
    console.log('🧹 LandscapeConstructor размонтирован, очищаю 3D кеш');
    clearModelCache();
  };
}, []);


  // ✅ ОПТИМИЗИРОВАННЫЙ РЕНДЕР 2D
  useEffect(() => {
    if (is3D) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Очистка
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Сетка
    if (project.showGrid) {
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += project.gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += project.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
    }

    // Рисование объектов
    project.objects.forEach((obj) => {
      ctx.save();

      // 1. ПЕРЕМЕЩАЕМ ХОЛСТ К ЦЕНТРУ ОБЪЕКТА (для поворота)
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);

      // Определяем форму по ТИПУ объекта
      const isCircle = obj.type === 'plant'; // 🌿 Растения = КРУГ
      const radius = Math.min(obj.width, obj.height) / 2;

      // 2. РИСУЕМ ТЕНЬ
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(2, 2, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-obj.width / 2 + 2, -obj.height / 2 + 2, obj.width, obj.height);
      }

      // 3. РИСУЕМ САМ ОБЪЕКТ (ЦВЕТ)
      ctx.fillStyle = obj.color || '#888888';
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
      }

      // 4. РИСУЕМ ОБВОДКУ
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
      }

      // 5. РИСУЕМ ТЕКСТ В ЦЕНТРЕ
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.name.substring(0, 5), 0, 0);

      // 6. ХИТБОКС (если выбран)
      if (obj.id === selectedObjectId) {
        ctx.strokeStyle = 'rgba(255, 153, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(-obj.width / 2 - 5, -obj.height / 2 - 5, obj.width + 10, obj.height + 10);
        }
        ctx.setLineDash([]);
      }

      ctx.restore();
    });


  }, [project, selectedObjectId, is3D]);
  // ============ ДОБАВЛЕНИЕ ОБЪЕКТА ============


  const addObject = (libraryItem: LibraryItem, x: number, y: number) => {
    // 1. Создаем объект
    const newObject: SceneObject = {
      id: `obj-${Date.now()}-${Math.random()}`,
      libraryId: libraryItem.id,
      type: libraryItem.type,
      name: libraryItem.name,
      x: Math.round(x / project.gridSize) * project.gridSize,
      y: Math.round(y / project.gridSize) * project.gridSize,
      width: libraryItem.width,
      height: libraryItem.height,
      rotation: 0,
      color: undefined,  // ← ИЗМЕНИТЬ: не берем цвет из библиотеки
      icon: libraryItem.icon,
      useNativeColor: true,
      colorChanged: false,  // ← ДОБАВИТЬ
      scaleX: 1,  // ← ДОБАВИТЬ
      scaleY: 1,  // ← ДОБАВИТЬ
    };

    // 2. Используем функциональное обновление для setProject
    setProject((prevProject) => {
      const newObjects = [...prevProject.objects, newObject];
      const newProject = { ...prevProject, objects: newObjects };

      // 3. Обновляем историю и синхронизацию внутри этого же потока или используя новый newProject
      setHistory((prevHistory) => [...prevHistory, newProject]);
      setLastSyncedObjects(newObjects);

      return newProject;
    });
  };




  // ✅ Быстрое обновление БЕЗ истории
  const updateObjectImmediate = (id: string, updates: Partial<SceneObject>) => {
    const newObjects = project.objects.map((obj) =>
      obj.id === id ? { ...obj, ...updates } : obj
    );

    const newProject = { ...project, objects: newObjects };
    setProject(newProject);
  };

  // ✅ Сохранить в историю
  const commitChanges = () => {
    setHistory([...history, project]);
    setLastSyncedObjects([...project.objects]);
  };

  // ============ УДАЛЕНИЕ ОБЪЕКТА ============
  const deleteObject = (id: string) => {
    const newObjects = project.objects.filter((obj) => obj.id !== id);
    const newProject = { ...project, objects: newObjects };

    setProject(newProject);
    setHistory([...history, newProject]);
    setLastSyncedObjects(newObjects);
    setSelectedObjectId(null);
  };

  // ============ UNDO ============
  const undo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      const restoredProject = newHistory[newHistory.length - 1];
      setProject(restoredProject);
      setLastSyncedObjects([...restoredProject.objects]);
      setSelectedObjectId(null);
    }
  };

  const updateGroundType = (type: Project['groundType']) => {
    const newProject = { ...project, groundType: type };
    setProject(newProject);
    setHistory([...history, newProject]);
  };

  const toggleGrid = () => {
    const newProject = { ...project, showGrid: !project.showGrid };
    setProject(newProject);
    setHistory([...history, newProject]);
  };

  // ============ НАЧАЛО ПЕРЕТАСКИВАНИЯ ============

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedLibraryItem) {
      setMouseDownTime(Date.now());
      setMovedDistance(0);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 👇 ИСПОЛЬЗУЙ getCanvasCoordinates (с учетом масштаба)
    const { x, y } = getCanvasCoordinates(e, canvas);

    // 🔧 ПРАВИЛЬНО: цикл с конца (от верхних объектов к нижним)
    for (let i = project.objects.length - 1; i >= 0; i--) {
      const obj = project.objects[i];

      if (
        x >= obj.x &&
        x <= obj.x + obj.width &&
        y >= obj.y &&
        y <= obj.y + obj.height
      ) {
        setDraggedObjectId(obj.id);
        setDragOffset({
          x: x - obj.x,
          y: y - obj.y,
        });
        setSelectedObjectId(obj.id);
        setMouseDownTime(Date.now());
        setMovedDistance(0);
        return;
      }
    }

    setSelectedObjectId(null);
    setMouseDownTime(Date.now());
    setMovedDistance(0);
  };

  // ============ ЗАМЕНИ handleCanvasMouseMove НА ЭТО: ============

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 👇 ИСПОЛЬЗУЙ getCanvasCoordinates (с учетом масштаба)
    const { x, y } = getCanvasCoordinates(e, canvas);

    if (draggedObjectId) {
      const draggedObjIndex = project.objects.findIndex(o => o.id === draggedObjectId);

      if (draggedObjIndex !== -1) {
        const obj = project.objects[draggedObjIndex];
        const newX = Math.max(0, Math.min(x - dragOffset.x, 1200 - obj.width));
        const newY = Math.max(0, Math.min(y - dragOffset.y, 700 - obj.height));

        const updatedObjects = [...project.objects];
        updatedObjects[draggedObjIndex] = {
          ...obj,
          x: newX,
          y: newY,
        };

        const newProject = { ...project, objects: updatedObjects };
        setProject(newProject);
      }
    }
  };
  // ============ ЗАМЕНИ handleCanvasMouseUp НА ЭТО: ============

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const timeDelta = Date.now() - mouseDownTime;

    if (draggedObjectId) {
      // Перетаскивали - сохраняем в историю
      setHistory([...history, project]);
      setLastSyncedObjects([...project.objects]);
      setDraggedObjectId(null);
    } else if (timeDelta < 200 && draggedLibraryItem) {
      // Быстрый клик на библиотеку - добавляем объект
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 👇 ИСПОЛЬЗУЙ getCanvasCoordinates (с учетом масштаба)
      const { x, y } = getCanvasCoordinates(e, canvas);
      addObject(draggedLibraryItem, x, y);
      setDraggedLibraryItem(null);
    }

    setMouseDownTime(0);
    setMovedDistance(0);
  };
  // ============ DRAG & DROP ============
  const handleCanvasDrag = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!draggedLibraryItem) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 👇 ПРЕОБРАЗУЙ DragEvent в MouseEvent и используй getCanvasCoordinates
    const { x, y } = getCanvasCoordinates(e as any as React.MouseEvent, canvas);
    addObject(draggedLibraryItem, x, y);
    setDraggedLibraryItem(null);
  };

  // ✅ ПЕРЕКЛЮЧЕНИЕ 2D/3D
  const handle3DToggle = (enable3D: boolean) => {
  if (enable3D) {
    // ➡️ Переход в 3D
    setLastSyncedObjects([...project.objects]);
    setHas3DChanges(false);
    console.log('📱 Переходим в 3D режим');
  } else {
    // ⬅️ Выход из 3D
    console.log('📱 Выходим из 3D режима, очищаем кеш...');
    clearModelCache(); // 🔥 главное добавление

    if (has3DChanges) {
      console.log('💾 Есть изменения в 3D, сохраняем...');
      commitChanges();
    } else {
      console.log('🔄 Нет изменений, откатываемся к lastSyncedObjects');
      const newProject = { ...project, objects: [...lastSyncedObjects] };
      setProject(newProject);
      commitChanges();
    }

    setHas3DChanges(false);
  }

  setIs3D(enable3D);
  setSelectedObjectId(null);
};


  // ✅ Обновление из 3D
  const handleObjectUpdate3D = (id: string, updates: Partial<SceneObject>) => {
    updateObjectImmediate(id, updates);
    setHas3DChanges(true);
  };



  // ============ СОХРАНЕНИЕ ПРОЕКТА ============
 // ============ СОСТОЯНИЕ ДЛЯ СКРИНШОТОВ ============
const [savedScreenshots, setSavedScreenshots] = useState<{
  image2D: string | null;
  image3D: string | null;
}>({
  image2D: null,
  image3D: null,
});

// ============ ЭКСПОРТ ============

// 📸 СОХРАНИТЬ - скриншот 3D ландшафта (вид сверху)
const saveProject = async () => {
  try {
    // В 3D режиме камера уже смотрит сверху
    // Просто берем WebGL canvas
    const workspace = document.querySelector('.workspace');
    const canvases = workspace?.querySelectorAll('canvas');
    const canvas3D = canvases && canvases.length > 0 
      ? (canvases[canvases.length - 1] as HTMLCanvasElement)
      : null;

    if (!canvas3D) {
      alert('❌ 3D Canvas не найден');
      return;
    }

    // Используем requestAnimationFrame чтобы убедиться что сцена отрендерилась
    requestAnimationFrame(() => {
      canvas3D.toBlob((blob) => {
        if (!blob) {
          alert('❌ Не удалось создать скриншот');
          return;
        }
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${project.name || 'landscape'}_3d_${new Date().getTime()}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        alert('✅ PNG сохранен!');
      }, 'image/png', 1.0);
    });
  } catch (error) {
    console.error('❌ Ошибка:', error);
    alert('❌ Ошибка при сохранении');
  }
};

// 📄 ЭКСПОРТ PDF - 2D + 3D фото в одном файле







  const selectedObject = project.objects.find((obj) => obj.id === selectedObjectId);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="landscape-editor">
      <div className="editor-container">
        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <aside className="library-panel">
          <h3>📚 Библиотека</h3>
          <div className="library-categories">
            {['plant', 'furniture', 'doors'].map((category) => (
              <div key={category} className="library-category">
                <h4>
                  {category === 'plant' && '🌿 Растения'}
                  {category === 'furniture' && 'Дома'}
                  {category === 'doors' && 'Ворота'}
                </h4>
                <div className="library-items">
                  {LIBRARY.filter((item) => item.type === category).map((item) => (
                    <div
                      key={item.id}
                      className="library-item"
                      draggable
                      onDragStart={() => setDraggedLibraryItem(item)}
                      onClick={() => addObject(item, 200, 200)}
                      title="Нажмите или перетащите на сцену"
                    >
                      {/* 👇 ПРОВЕРЯЕМ ЕСТЬ ЛИ ПУТЬ К ФАЙЛУ */}
                      {item.icon.startsWith('/') || item.icon.startsWith('http') || item.icon.startsWith('../../') ? (
                        <img
                          src={item.icon}
                          alt={item.name}
                          className="library-item-icon"
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'contain',
                            margin: '0 auto'
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        // Если это эмодзи, выводим как текст
                        <span className="library-item-icon">{item.icon}</span>
                      )}
                      <span className="library-item-name">{item.name}</span>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </aside>

        {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ */}
        <main className="workspace">
          {!is3D ? (
            <canvas
              ref={canvasRef}
              width={1200}
              height={700}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onDragOver={handleCanvasDrag}
              onDrop={handleCanvasDrop}
              className="canvas"
              style={{
                cursor: draggedObjectId ? 'grabbing' : (draggedLibraryItem ? 'copy' : 'grab'),
                backgroundColor: project.backgroundColor,
              }}
            />
          ) : (
            <Viewport3D
              objects={project.objects}
              backgroundColor={project.backgroundColor}
              groundType={project.groundType}
              showGrid={project.showGrid}
              activeTool={activeTool}
              onObjectSelect={setSelectedObjectId}
              onObjectUpdate={handleObjectUpdate3D}
            />
          )}

          <div className="workspace-controls">
            <button onClick={() => handle3DToggle(!is3D)} className="btn-secondary">
              {is3D ? '2D Вид' : '3D Вид'}
            </button>
            <button onClick={undo} className="btn-secondary" disabled={history.length <= 1}>
              ↶ Отменить
            </button>
          </div>
        </main>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <aside className="properties-panel">

          <div className="tools-group" style={{ marginBottom: '20px' }}>
            <h4>🛠️ Инструменты</h4>
            <button
              onClick={() => setActiveTool(activeTool === 'scale' ? null : 'scale')}
              style={{
                padding: '10px 16px',
                width: '100%',
                background: activeTool === 'scale' ? '#4da6ff' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTool === 'scale' ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              📐 {activeTool === 'scale' ? 'Scale (активен)' : 'Scale'}
            </button>
          </div>

          <h3>⚙️ Свойства</h3>

          <div className="property-group">
            <label>Тип земли</label>
            <div className="ground-type-grid">
              {(['grass', 'asphalt', 'sand', 'soil', 'water'] as const).map((type) => (
                <button
                  key={type}
                  className={`ground-type-btn ${project.groundType === type ? 'active' : ''}`}
                  onClick={() => updateGroundType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="property-group">
            <label>
              <input
                type="checkbox"
                checked={project.showGrid}
                onChange={toggleGrid}
              />
              Показать сетку
            </label>
          </div>

          {selectedObject ? (
            <div className="object-properties">
              <div className="property">
                <label>Объект:</label>
                <span>{selectedObject.name}</span>
              </div>

              <div className="property">
                <label>X:</label>
                <input
                  type="number"
                  value={Math.round(selectedObject.x)}
                  onChange={(e) => {
                    const newVal = Math.max(0, parseFloat(e.target.value) || 0);
                    updateObjectImmediate(selectedObjectId!, { x: newVal });
                  }}
                  onBlur={() => commitChanges()}
                  className="property-input"
                />
              </div>

              <div className="property">
                <label>Y:</label>
                <input
                  type="number"
                  value={Math.round(selectedObject.y)}
                  onChange={(e) => {
                    const newVal = Math.max(0, parseFloat(e.target.value) || 0);
                    updateObjectImmediate(selectedObjectId!, { y: newVal });
                  }}
                  onBlur={() => commitChanges()}
                  className="property-input"
                />
              </div>

              <div className="property">
                <label>Ширина:</label>
                <input
                  type="number"
                  value={selectedObject.width}
                  onChange={(e) => {
                    const newVal = Math.max(10, parseFloat(e.target.value) || 10);
                    updateObjectImmediate(selectedObjectId!, { width: newVal });
                  }}
                  onBlur={() => commitChanges()}
                  className="property-input"
                />
              </div>

              <div className="property">
                <label>Высота:</label>
                <input
                  type="number"
                  value={selectedObject.height}
                  onChange={(e) => {
                    const newVal = Math.max(10, parseFloat(e.target.value) || 10);
                    updateObjectImmediate(selectedObjectId!, { height: newVal });
                  }}
                  onBlur={() => commitChanges()}
                  className="property-input"
                />
              </div>

              <div className="property">
                <label>Поворот: {selectedObject.rotation}°</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedObject.rotation}
                  onChange={(e) => {
                    const newVal = parseFloat(e.target.value);
                    updateObjectImmediate(selectedObjectId!, { rotation: newVal });
                  }}
                  onMouseUp={() => commitChanges()}
                  onTouchEnd={() => commitChanges()}
                  className="property-input"
                />
              </div>

              <div className="property">
                <label>Цвет:</label>
                <input
                  type="color"
                  value={selectedObject.color || '#888888'}
                  onChange={(e) => {
                    updateObjectImmediate(selectedObjectId!, {
                      color: e.target.value,
                      colorChanged: true  // ← ДОБАВИТЬ ЭТУ СТРОКУ
                    });
                    commitChanges();
                  }}
                  className="property-input"
                />

              </div>

              <button
                onClick={() => deleteObject(selectedObjectId!)}
                className="btn-danger"
              >
                🗑️ Удалить
              </button>
            </div>
          ) : (
            <div className="no-selection">
              <p>Нажмите на объект на сцене</p>
            </div>
          )}

          <div className="actions-panel">
            <h3>📁 Действия</h3>

            <button onClick={saveProject} className="btn-secondary">
              💾 Сохранить (PNG)
            </button>

          </div>

        </aside>
      </div>
    </div>
  );
};

const LandscapeConstructor: React.FC = () => {
  return <Editor />;
};

export default LandscapeConstructor;
