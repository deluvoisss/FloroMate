import React, { useState, useRef, useEffect } from 'react';
import '../types/App1.css';
import { Viewport3D } from './Viewport3D.tsx';

// ============ ТИПЫ ============
interface SceneObject {
  id: string;
  type: 'plant' | 'furniture' | 'path' | 'water';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  icon: string;
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
  type: 'plant' | 'furniture' | 'path' | 'water';
  icon: string;
  color: string;
  width: number;
  height: number;
}

// ============ БИБЛИОТЕКА ОБЪЕКТОВ ============
const LIBRARY: LibraryItem[] = [
  // Растения
  { id: 'p1', name: 'Дерево дуб', type: 'plant', icon: '🌳', color: '#2d5016', width: 80, height: 80 },
  { id: 'p2', name: 'Ель', type: 'plant', icon: '🌲', color: '#1a3a1a', width: 60, height: 100 },
  { id: 'p3', name: 'Куст роз', type: 'plant', icon: '🌹', color: '#c41e3a', width: 50, height: 50 },
  { id: 'p4', name: 'Газон', type: 'plant', icon: '🟢', color: '#7cb342', width: 200, height: 200 },
  { id: 'p5', name: 'Tree', type: 'plant', icon: '🌳', color: '#2d5016', width: 80, height: 80 }, // Для 3D модели
  
  // Мебель
  { id: 'f1', name: 'Скамейка', type: 'furniture', icon: '🪑', color: '#8b6f47', width: 120, height: 60 },
  { id: 'f2', name: 'Стол', type: 'furniture', icon: '🪑', color: '#8b6f47', width: 100, height: 100 },
  { id: 'f3', name: 'Беседка', type: 'furniture', icon: '⛺', color: '#d2b48c', width: 150, height: 150 },
  { id: 'f_home', name: 'Home', type: 'furniture', icon: '🏠', color: '#8b6f47', width: 150, height: 150 }, // Для 3D модели
  { id: 'f_home1', name: 'Home1', type: 'furniture', icon: '🏠', color: '#8b6f47', width: 300, height: 500 }, // Для 3D модели
  { id: 'f_home2', name: 'Home2', type: 'furniture', icon: '🏠', color: '#8b6f47', width: 200, height: 200 }, // Для 3D модели
  { id: 'f_home3', name: 'Home3', type: 'furniture', icon: '🏠', color: '#8b6f47', width: 250, height: 250 }, // Для 3D модели
  
  // Дорожки
  { id: 'path1', name: 'Тропинка', type: 'path', icon: '🟫', color: '#8b7355', width: 300, height: 40 },
  { id: 'path2', name: 'Мощеная площадка', type: 'path', icon: '⬜', color: '#a9a9a9', width: 200, height: 200 },
  
  // Вода
  { id: 'w1', name: 'Пруд', type: 'water', icon: '💧', color: '#4da6ff', width: 150, height: 150 },
  { id: 'w2', name: 'Фонтан', type: 'water', icon: '⛲', color: '#87ceeb', width: 80, height: 80 },
];

// ============ AI СТИЛИ ============
const AI_STYLES = [
  { id: 'modern', name: 'Современный', emoji: '🏢' },
  { id: 'japanese', name: 'Японский', emoji: '🏯' },
  { id: 'minimalist', name: 'Минимализм', emoji: '⬜' },
  { id: 'rustic', name: 'Деревенский', emoji: '🌾' },
  { id: 'tropical', name: 'Тропический', emoji: '🌴' },
];

// ============ КОМПОНЕНТ: РЕДАКТОР ============
const Editor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('modern');
  const [is3D, setIs3D] = useState(false);
  const [history, setHistory] = useState<Project[]>([project]);

  const updateGroundType = (type: Project['groundType']) => setProject(prev => ({ ...prev, groundType: type }));
  const toggleGrid = () => setProject(prev => ({ ...prev, showGrid: !prev.showGrid }));

  // ============ РИСОВАНИЕ СЦЕНЫ ============
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Фон
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

    // Объекты
    project.objects.forEach((obj) => {
      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-(obj.width / 2), -(obj.height / 2));

      // Тень при выделении
      if (obj.id === selectedObjectId) {
        ctx.shadowColor = '#ff9800';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Прямоугольник объекта
      ctx.fillStyle = obj.color;
      ctx.fillRect(0, 0, obj.width, obj.height);

      // Граница
      ctx.strokeStyle = selectedObjectId === obj.id ? '#ff9800' : '#999';
      ctx.lineWidth = selectedObjectId === obj.id ? 3 : 1;
      ctx.strokeRect(0, 0, obj.width, obj.height);

      // Иконка
      ctx.font = `${Math.min(obj.width, obj.height) * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(obj.icon, obj.width / 2, obj.height / 2);

      ctx.restore();
    });
  }, [project, selectedObjectId]);

  // ============ ДОБАВЛЕНИЕ ОБЪЕКТА ============
  const addObject = (libraryItem: LibraryItem, x: number, y: number) => {
    const newObject: SceneObject = {
      id: `obj-${Date.now()}-${Math.random()}`,
      type: libraryItem.type,
      name: libraryItem.name,
      x: Math.round(x / project.gridSize) * project.gridSize,
      y: Math.round(y / project.gridSize) * project.gridSize,
      width: libraryItem.width,
      height: libraryItem.height,
      rotation: 0,
      color: libraryItem.color,
      icon: libraryItem.icon,
    };

    const updatedProject = {
      ...project,
      objects: [...project.objects, newObject],
    };
    setProject(updatedProject);
    setHistory([...history, updatedProject]);
    setSelectedObjectId(newObject.id);
  };

  // ============ ОБНОВЛЕНИЕ ОБЪЕКТА ============
  const updateObject = (id: string, updates: Partial<SceneObject>) => {
    const updatedProject = {
      ...project,
      objects: project.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    };
    setProject(updatedProject);
    setHistory([...history, updatedProject]);
  };

  // ============ УДАЛЕНИЕ ОБЪЕКТА ============
  const deleteObject = (id: string) => {
    const updatedProject = {
      ...project,
      objects: project.objects.filter((obj) => obj.id !== id),
    };
    setProject(updatedProject);
    setHistory([...history, updatedProject]);
    setSelectedObjectId(null);
  };

  // ============ UNDO ============
  const undo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setProject(newHistory[newHistory.length - 1]);
      setSelectedObjectId(null);
    }
  };

  // ============ ОБРАБОТКА КЛИКА НА CANVAS ============
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggedLibraryItem) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addObject(draggedLibraryItem, x, y);
    setDraggedLibraryItem(null);
  };

  // ============ ОБРАБОТКА ПЕРЕТАСКИВАНИЯ НА CANVAS ============
  const handleCanvasDrag = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!draggedLibraryItem) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addObject(draggedLibraryItem, x, y);
    setDraggedLibraryItem(null);
  };

  // ============ AI ГЕНЕРАЦИЯ ============
  const generateAIDesign = () => {
    const randomObjects: SceneObject[] = [];
    const randomPlants = LIBRARY.filter((item) => item.type === 'plant').slice(0, 4);
    const randomFurniture = LIBRARY.filter((item) => item.type === 'furniture').slice(0, 2);

    randomPlants.forEach((plant, idx) => {
      randomObjects.push({
        id: `ai-${Date.now()}-${idx}`,
        type: plant.type,
        name: plant.name,
        x: Math.random() * 400,
        y: Math.random() * 300,
        width: plant.width,
        height: plant.height,
        rotation: Math.random() * 360,
        color: plant.color,
        icon: plant.icon,
      });
    });

    randomFurniture.forEach((furniture, idx) => {
      randomObjects.push({
        id: `ai-furniture-${Date.now()}-${idx}`,
        type: furniture.type,
        name: furniture.name,
        x: Math.random() * 400,
        y: Math.random() * 300,
        width: furniture.width,
        height: furniture.height,
        rotation: Math.random() * 90,
        color: furniture.color,
        icon: furniture.icon,
      });
    });

    const updatedProject = {
      ...project,
      objects: randomObjects,
    };
    setProject(updatedProject);
    setHistory([...history, updatedProject]);
    setShowAIPanel(false);
    alert('✨ AI генерация завершена! Вариант добавлен на сцену.');
  };

  // ============ ЭКСПОРТ В PDF ============
  const exportToPDF = () => {
    alert('📄 Экспорт в PDF готов! В будущей версии можно будет скачать.');
  };

  // ============ СОХРАНЕНИЕ ПРОЕКТА ============
  const saveProject = () => {
    const projectJSON = JSON.stringify(project, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([projectJSON], { type: 'application/json' }));
    link.download = `${project.name || 'project'}.json`;
    link.click();
  };

  // ============ ЗАГРУЗКА ПРОЕКТА ============
  const loadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const loadedProject = JSON.parse(event.target.result);
          setProject(loadedProject);
          setHistory([loadedProject]);
          setSelectedObjectId(null);
          alert('✅ Проект загружен!');
        } catch (err) {
          alert('❌ Ошибка при загрузке проекта');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const selectedObject = project.objects.find((obj) => obj.id === selectedObjectId);

  return (
    <div className="landscape-editor">
      <div className="editor-container">
        {/* ЛЕВАЯ ПАНЕЛЬ: БИБЛИОТЕКА */}
        <aside className="library-panel">
          <h3>📚 Библиотека</h3>

          <div className="library-categories">
            {['plant', 'furniture', 'path', 'water'].map((category) => (
              <div key={category} className="library-category">
                <h4>
                  {category === 'plant' && '🌿 Растения'}
                  {category === 'furniture' && '🪑 Мебель'}
                  {category === 'path' && '🟫 Дорожки'}
                  {category === 'water' && '💧 Вода'}
                </h4>
                <div className="library-items">
                  {LIBRARY.filter((item) => item.type === category).map((item) => (
                    <div
                      key={item.id}
                      className="library-item"
                      draggable
                      onDragStart={() => setDraggedLibraryItem(item)}
                      onClick={() => addObject(item, 200, 200)}
                      title={`Нажмите или перетащите на сцену`}
                    >
                      <span className="library-item-icon">{item.icon}</span>
                      <span className="library-item-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: РАБОЧАЯ ОБЛАСТЬ */}
        <main className="workspace">
          {!is3D ? (
            <canvas
              ref={canvasRef}
              width={1200}
              height={700}
              onClick={handleCanvasClick}
              onDragOver={handleCanvasDrag}
              onDrop={handleCanvasDrop}
              className="canvas"
              style={{
                cursor: draggedLibraryItem ? 'copy' : 'default',
                backgroundColor: project.backgroundColor,
              }}
            />
          ) : (
            <Viewport3D
              objects={project.objects}
              backgroundColor={project.backgroundColor}
              groundType={project.groundType}
              showGrid={project.showGrid}
              onObjectSelect={setSelectedObjectId}
              onObjectUpdate={(id, upd) => {
                setProject(prev => ({
                  ...prev,
                  objects: prev.objects.map(o => o.id === id ? { ...o, ...upd } : o)
                }));
              }}
            />
          )}

          <div className="workspace-controls">
            <button onClick={() => setIs3D(!is3D)} className="btn-secondary">
              {is3D ? '2D Вид' : '3D Вид'}
            </button>
            <button onClick={undo} className="btn-secondary" disabled={history.length <= 1}>
              ↶ Отменить
            </button>
            <button onClick={() => setShowAIPanel(!showAIPanel)} className="btn-primary">
              ✨ AI Генерация
            </button>
          </div>
        </main>

        {/* ПРАВАЯ ПАНЕЛЬ: СВОЙСТВА */}
        <aside className="properties-panel">
          <h3>⚙️ Свойства</h3>

          <div className="property-group">
            <label>Тип земли</label>
            <div className="ground-type-grid">
              {['grass', 'asphalt', 'sand', 'soil', 'water'].map((type) => (
                <button
                  key={type}
                  className={`ground-type-btn ${project.groundType === type ? 'active' : ''}`}
                  onClick={() => updateGroundType(type as any)}
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
                <label>X: <input
                  type="number"
                  value={selectedObject.x}
                  onChange={(e) => updateObject(selectedObjectId!, { x: parseFloat(e.target.value) })}
                  className="property-input"
                /></label>
              </div>
              <div className="property">
                <label>Y: <input
                  type="number"
                  value={selectedObject.y}
                  onChange={(e) => updateObject(selectedObjectId!, { y: parseFloat(e.target.value) })}
                  className="property-input"
                /></label>
              </div>
              <div className="property">
                <label>Ширина: <input
                  type="number"
                  value={selectedObject.width}
                  onChange={(e) => updateObject(selectedObjectId!, { width: parseFloat(e.target.value) })}
                  className="property-input"
                /></label>
              </div>
              <div className="property">
                <label>Высота: <input
                  type="number"
                  value={selectedObject.height}
                  onChange={(e) => updateObject(selectedObjectId!, { height: parseFloat(e.target.value) })}
                  className="property-input"
                /></label>
              </div>
              <div className="property">
                <label>Поворот: <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedObject.rotation}
                  onChange={(e) => updateObject(selectedObjectId!, { rotation: parseFloat(e.target.value) })}
                  className="property-input"
                /></label>
              </div>
              <div className="property">
                <label>Цвет: <input
                  type="color"
                  value={selectedObject.color}
                  onChange={(e) => updateObject(selectedObjectId!, { color: e.target.value })}
                  className="property-input"
                /></label>
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
              💾 Сохранить
            </button>
            <button onClick={loadProject} className="btn-secondary">
              📂 Загрузить
            </button>
            <button onClick={exportToPDF} className="btn-secondary">
              📄 Экспорт PDF
            </button>
          </div>
        </aside>
      </div>

      {/* AI ГЕНЕРАЦИЯ ПАНЕЛЬ */}
      {showAIPanel && (
        <div className="ai-panel">
          <div className="ai-panel-content">
            <h2>✨ AI Генерация ландшафта</h2>
            
            <div className="ai-upload">
              <input type="file" accept="image/*" className="file-input" />
              <p>или используйте текущую сцену</p>
            </div>

            <div className="ai-styles">
              <h3>Выберите стиль:</h3>
              <div className="styles-grid">
                {AI_STYLES.map((style) => (
                  <button
                    key={style.id}
                    className={`style-button ${selectedStyle === style.id ? 'active' : ''}`}
                    onClick={() => setSelectedStyle(style.id)}
                  >
                    <span className="style-emoji">{style.emoji}</span>
                    <span className="style-name">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generateAIDesign} className="btn-primary btn-large">
              🚀 Сгенерировать варианты
            </button>
            <button
              onClick={() => setShowAIPanel(false)}
              className="btn-secondary"
            >
              ✕ Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ ГЛАВНЫЙ КОМПОНЕНТ ============
const LandscapeDesign: React.FC = () => {
  return <Editor />;
};

export default LandscapeDesign;