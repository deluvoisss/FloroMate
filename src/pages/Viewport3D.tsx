import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { HandleManager, type DraggedHandleData } from '../components/forConstrucotr/HandleManager';



interface SceneObject {
  libraryId: string;
  id: string;
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
  colorChanged?: boolean;
  scaleX?: number;
  scaleY?: number;
}

interface Viewport3DProps {
  objects: SceneObject[];
  backgroundColor: string;
  groundType: 'grass' | 'asphalt' | 'sand' | 'soil' | 'water';
  showGrid: boolean;
  activeTool?: 'move' | 'scale' | null;
  onObjectSelect?: (objectId: string) => void;
  onObjectUpdate?: (objectId: string, updates: Partial<SceneObject>) => void;
}

const MODEL_PATHS: Record<string, string> = {
  'p5': 'http://147.45.184.57/treeModels/tree.glb',
  'flow': 'http://147.45.184.57/treeModels/flow.glb',
  'poly': 'http://147.45.184.57/treeModels/poly.glb',
  'f_home': 'http://147.45.184.57/treeModels/home.glb',
  'f_home2': 'http://147.45.184.57/treeModels/home1.glb',
  'f_home3': 'http://147.45.184.57/treeModels/modern.glb',
  'amh': 'http://147.45.184.57/treeModels/amho.glb',
  'asd': 'http://147.45.184.57/treeModels/asd.glb',
  'barn': 'http://147.45.184.57/treeModels/barn.glb',
  'qwe': 'http://147.45.184.57/treeModels/qwe.glb',
  'fenc1': 'http://147.45.184.57/treeModels/fenc.glb',
  'fence1': 'http://147.45.184.57/treeModels/fence.glb',
  'fence2': 'http://147.45.184.57/treeModels/fences.glb',
  'fence3': 'http://147.45.184.57/treeModels/fencess.glb',
};

const GROUND_COLORS = {
  grass: 0x7cb342,
  asphalt: 0x505050,
  sand: 0xf2e394,
  soil: 0x9b7653,
  water: 0x4da6ff,
};

const modelCache = new Map<string, THREE.Group>();
const loadingPromises = new Map<string, Promise<THREE.Group>>();
const loadQueue = new Set<string>();
let isProcessingQueue = false;
let activeLoads = 0;
const MAX_CONCURRENT_LOADS = 3;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;
const WORLD_SIZE_X = 40;
const WORLD_SIZE_Y = 23.33;
const SCALE = CANVAS_WIDTH / WORLD_SIZE_X;
const CANVAS_CENTER_X = CANVAS_WIDTH / 2;
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;

export function clearModelCache() {
  console.log('🧹 Начинаю очистку 3D кеша...');

  modelCache.forEach((model) => {
    try {
      model.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => {
              if (mat && typeof mat.dispose === 'function') {
                mat.dispose();
              }
            });
          } else if (child.material && typeof child.material.dispose === 'function') {
            child.material.dispose();
          }
        }
      });
    } catch (error) {
      console.error('⚠️ Ошибка при очистке модели из кеша:', error);
    }
  });

  modelCache.clear();
  loadingPromises.clear();
  loadQueue.clear();
  activeLoads = 0;
  isProcessingQueue = false;

  console.log('✅ 3D кеш полностью очищен');
}

function canvas2DToWorld3D(x: number, y: number) {
  return {
    x: (x - CANVAS_CENTER_X) / SCALE,
    z: (y - CANVAS_CENTER_Y) / SCALE * (WORLD_SIZE_Y / WORLD_SIZE_X),
  };
}

function world3DToCanvas2D(x: number, z: number) {
  return {
    x: x * SCALE + CANVAS_CENTER_X,
    y: z * SCALE * (WORLD_SIZE_X / WORLD_SIZE_Y) + CANVAS_CENTER_Y,
  };
}

async function processLoadQueue(): Promise<void> {
  if (isProcessingQueue || activeLoads >= MAX_CONCURRENT_LOADS) return;
  isProcessingQueue = true;

  while (loadQueue.size > 0 && activeLoads < MAX_CONCURRENT_LOADS) {
    const modelPath = Array.from(loadQueue)[0];
    if (!modelPath) break;

    loadQueue.delete(modelPath);
    activeLoads++;

    try {
      await loadModel(modelPath);
    } catch (error) {
      console.error('❌ Ошибка загрузки:', modelPath, error);
    } finally {
      activeLoads--;

      if (loadQueue.size > 0 && activeLoads < MAX_CONCURRENT_LOADS) {
        await processLoadQueue();
      }
    }
  }

  isProcessingQueue = false;
}

function loadModel(path: string): Promise<THREE.Group> {
  return new Promise<THREE.Group>((resolve, reject) => {
    // ПРОВЕРЯЕМ КЕШ
    if (modelCache.has(path)) {
      console.log(`✅ Из кеша: ${path.split('/').pop()}`);
      const cached = modelCache.get(path);
      if (cached) {
        resolve(cached.clone());
        return;
      }
    }

    // ЕСЛИ УЖЕ ЗАГРУЖАЕТСЯ - ЖДЕМ
    if (loadingPromises.has(path)) {
      console.log(`⏳ Ждем загрузку: ${path.split('/').pop()}`);
      const existingPromise = loadingPromises.get(path);
      if (existingPromise) {
        existingPromise
          .then((model) => resolve(model.clone()))
          .catch((err) => reject(err));
        return;
      }
    }

    // ЗАПУСКАЕМ ЗАГРУЗКУ
    console.log(`📥 Загружаю: ${path.split('/').pop()}`);

    const modelLoader = new GLTFLoader();
    const loadPromise = new Promise<THREE.Group>((innerResolve, innerReject) => {
      modelLoader.load(
        path,
        (gltf) => {
          const scene = gltf.scene;

          const originalColors = new Map<THREE.Material, THREE.Color>();
          scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat && typeof mat === 'object' && 'color' in mat) {
                    const colorValue = (mat as any).color;
                    if (colorValue instanceof THREE.Color) {
                      originalColors.set(mat, colorValue.clone());
                    }
                  }
                });
              } else if (child.material && typeof child.material === 'object' && 'color' in child.material) {
                const mat = child.material as any;
                const colorValue = mat.color;
                if (colorValue instanceof THREE.Color) {
                  originalColors.set(mat, colorValue.clone());
                }
              }
            }
          });

          (scene as any).__originalColors = originalColors;
          modelCache.set(path, scene);
          loadingPromises.delete(path);

          console.log(`✅ Загружена: ${path.split('/').pop()}`);
          innerResolve(scene.clone());
        },
        undefined,
        (error) => {
          console.error(`❌ Ошибка загрузки ${path}:`, error);
          loadingPromises.delete(path);
          innerReject(error);
        }
      );
    });

    loadingPromises.set(path, loadPromise);
    loadPromise
      .then((model) => resolve(model))
      .catch((err) => reject(err));
  });
}

function restoreOriginalColor(model: THREE.Group, cachedModel: THREE.Group): void {
  const originalColors = (cachedModel as any).__originalColors as Map<THREE.Material, THREE.Color> | undefined;
  if (!originalColors) return;

  model.traverse((child: any) => {
    if (child instanceof THREE.Mesh) {
      // ✅ ВАЖНО: клонируем материалы перед восстановлением цвета!
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat: any) => {
          const cloned = mat.clone();
          const originalColor = originalColors.get(mat);
          if (originalColor instanceof THREE.Color) {
            cloned.color.copy(originalColor);
          }
          return cloned;
        });
      } else if (child.material) {
        const cloned = child.material.clone();
        const originalColor = originalColors.get(child.material);
        if (originalColor instanceof THREE.Color) {
          cloned.color.copy(originalColor);
        }
        child.material = cloned;
      }
    }
  });
}


function applyColorToModel(model: THREE.Group | THREE.Mesh, color: string | undefined): void {
  if (!color) return;
  const threeColor = new THREE.Color(color);
  model.traverse((child: any) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat: any) => {
          if (
            mat &&
            typeof mat === 'object' &&
            'color' in mat &&
            (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial)
          ) {
            mat.color.set(threeColor);
          }
        });
      } else if (
        child.material &&
        typeof child.material === 'object' &&
        'color' in child.material
      ) {
        const mat = child.material as any;
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial) {
          mat.color.set(threeColor);
        }
      }
    }
  });
}

export const Viewport3D = ({
  objects,
  backgroundColor,
  groundType,
  showGrid,
  activeTool,
  onObjectSelect,
  onObjectUpdate,
}: Viewport3DProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<Map<string, THREE.Group>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const groundRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);

  const handleManagerRef = useRef<HandleManager | null>(null);
  const pendingObjectsRef = useRef<Set<string>>(new Set());

  const stateRef = useRef({
    isRotating: false,
    isDragging: false,
    isDraggingHandle: false,
    draggedHandleData: null as DraggedHandleData | null,
    selectedObjectId: null as string | null,
    cameraControl: {
      theta: 0,
      phi: Math.PI / 4,
      radius: 15,
      target: new THREE.Vector3(0, 2, 0),
    },
  });

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const bgColor = parseInt(backgroundColor.replace('#', '0x'), 16);
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 10, 500);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 10, 20);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.sortObjects = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(40, 23.33);
    const groundColor = GROUND_COLORS[groundType] || GROUND_COLORS.grass;
    const groundMaterial = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    if (showGrid) {
      const gridHelper = new THREE.GridHelper(40, 80, 0x555555, 0x555555);
      gridHelper.position.y = 0.02;
      if (gridHelper.material instanceof THREE.Material) {
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.2;
      }
      scene.add(gridHelper);
      gridRef.current = gridHelper;
    }

    handleManagerRef.current = new HandleManager(scene);

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

     return () => {
    console.log('🧹 Очищаю Viewport3D ресурсы...');

    // 1️⃣ очищаем объекты, которые мы добавили на сцену
    if (objectsRef.current) {
      objectsRef.current.forEach((mesh) => {
        mesh.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat && typeof mat.dispose === 'function') {
                  mat.dispose();
                }
              });
            } else if (child.material && typeof child.material.dispose === 'function') {
              child.material.dispose();
            }
          }
        });
      });
      objectsRef.current.clear();
    }

    // 2️⃣ очищаем материалы/геометрии остальных мешей в сцене
    if (sceneRef.current) {
      sceneRef.current.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => {
              if (mat && typeof mat.dispose === 'function') {
                mat.dispose();
              }
            });
          } else if (child.material && typeof child.material.dispose === 'function') {
            child.material.dispose();
          }
        }
      });
    }

    // 3️⃣ убираем renderer и WebGL контекст
    if (rendererRef.current) {
      try {
        rendererRef.current.dispose();
        // освобождаем GPU контекст, как рекомендуют в three.js [web:5][web:8]
        (rendererRef.current as any).forceContextLoss?.();
      } catch (e) {
        console.error('⚠️ Ошибка при dispose renderer:', e);
      }

      if (container && rendererRef.current.domElement.parentNode === container) {
        container.removeChild(rendererRef.current.domElement);
      }
    }

    // 4️⃣ отписываемся от событий
    window.removeEventListener('resize', handleResize);
    // 5️⃣ чистим HandleManager, если у него есть dispose
    handleManagerRef.current?.dispose?.();

    console.log('✅ Viewport3D полностью очищен');
  };
}, []);

  useEffect(() => {
    if (!sceneRef.current || !groundRef.current) return;

    const groundColor = GROUND_COLORS[groundType] || GROUND_COLORS.grass;
    const groundMaterial = groundRef.current.material;
    if (groundMaterial instanceof THREE.MeshLambertMaterial) {
      groundMaterial.color.set(groundColor);
    }

    const bgColor = parseInt(backgroundColor.replace('#', '0x'), 16);
    if (sceneRef.current.background instanceof THREE.Color) {
      sceneRef.current.background.set(bgColor);
    }
    if (sceneRef.current.fog instanceof THREE.Fog) {
      sceneRef.current.fog.color.set(bgColor);
    }
  }, [backgroundColor, groundType]);


  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (showGrid && !gridRef.current) {
      const gridHelper = new THREE.GridHelper(40, 80, 0x555555, 0x555555);
      gridHelper.position.y = 0.02;
      if (gridHelper.material instanceof THREE.Material) {
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.2;
      }
      scene.add(gridHelper);
      gridRef.current = gridHelper;
    } else if (!showGrid && gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current = null;
    }
  }, [showGrid]);

  useEffect(() => {
    if (!handleManagerRef.current) return;

    // Показываем handles только если Scale инструмент активен
    if (selectedObjectId && activeTool === 'scale') {
      const selectedMesh = objectsRef.current.get(selectedObjectId);
      if (selectedMesh) {
        const boundingBox = new THREE.Box3().setFromObject(selectedMesh);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        handleManagerRef.current.createHandles(selectedObjectId, center, size);
      }
    } else {
      handleManagerRef.current.removeAllHandles();
    }
  }, [selectedObjectId, objects, activeTool]);


  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    (async () => {
      const currentIds = new Set(objects.map((o) => o.id));

      const idsToRemove: string[] = [];
      objectsRef.current.forEach((mesh, id) => {
        if (!currentIds.has(id)) {
          scene.remove(mesh);
          idsToRemove.push(id);
          pendingObjectsRef.current.delete(id);

          if (id === selectedObjectId) {
            handleManagerRef.current?.removeAllHandles();
            setSelectedObjectId(null);
          }
        }
      });
      idsToRemove.forEach((id) => objectsRef.current.delete(id));

      for (const obj of objects) {
        const { x: worldX, z: worldZ } = canvas2DToWorld3D(obj.x, obj.y);
        const modelPath = MODEL_PATHS[obj.libraryId];

        if (!modelPath) {
          console.warn(`⚠️ Модель не найдена: ${obj.libraryId}`);
          continue;
        }

        // ✅ ЕСЛИ ОБЪЕКТ УЖЕ НА СЦЕНЕ
        // ✅ ЕСЛИ ОБЪЕКТ УЖЕ НА СЦЕНЕ
        if (objectsRef.current.has(obj.id)) {
          const mesh = objectsRef.current.get(obj.id)!;

          // ТОЛЬКО обновляем позицию и ротацию
          mesh.position.set(worldX, 1, worldZ);
          mesh.rotation.y = (obj.rotation * Math.PI) / 180;

          mesh.updateMatrix();
          mesh.updateMatrixWorld(true);

          // ✅ ВСЕГДА проверяем цвет
          if (obj.color) {
            applyColorToModel(mesh as THREE.Group, obj.color);
          }

          continue;
        }


        // ✅ ЕСЛИ ОБЪЕКТ ЕЩЕ ЗАГРУЖАЕТСЯ
        if (pendingObjectsRef.current.has(obj.id)) {
          continue;
        }

        pendingObjectsRef.current.add(obj.id);

        if (!modelCache.has(modelPath)) {
          loadQueue.add(modelPath);
        }

        try {
          const cachedModel = modelCache.get(modelPath);
          const model = await loadModel(modelPath);

          if (!currentIds.has(obj.id)) {
            console.log(`⏭️ Пропускаю ${obj.name} - объект был удален`);
            pendingObjectsRef.current.delete(obj.id);
            continue;
          }

          if (objectsRef.current.has(obj.id)) {
            console.log(`⏭️ Пропускаю ${obj.name} - уже на сцене`);
            pendingObjectsRef.current.delete(obj.id);
            continue;
          }

          // ✅ ВЫЧИСЛЯЕМ БАЗОВЫЙ МАСШТАБ ПРИ ЗАГРУЗКЕ
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const baseScale = (7 / maxDim) * 1.4;

          // СОХРАНЯЕМ baseScale В userData
          const scaleX = (obj.scaleX || 1) * baseScale;
          const scaleY = (obj.scaleY || 1) * baseScale;

          model.position.set(worldX, 1, worldZ);
          model.rotation.y = (obj.rotation * Math.PI) / 180;
          model.scale.set(scaleX, scaleY, scaleX);

          // ✅ СОХРАНЯЕМ БАЗОВЫЙ МАСШТАБ
          model.userData = {
            objectId: obj.id,
            modelPath,
            baseScale  // ← ДОБАВИЛИ
          };

          // ✅ КАЖДЫЙ ОБЪЕКТ ИМЕЕТ СВОЙ ЦВЕТ
          if (obj.color) {
            // Если у объекта есть цвет - применяем его
            applyColorToModel(model, obj.color);
          } else {
            // Если цвета нет - используем оригинальный цвет модели
            if (cachedModel) {
              restoreOriginalColor(model, cachedModel);
            }
          }


          model.frustumCulled = false;
          model.traverse((child: any) => {
            child.userData = { objectId: obj.id, modelPath };
            child.frustumCulled = false;
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          model.updateMatrix();
          model.updateMatrixWorld(true);

          if (!objectsRef.current.has(obj.id)) {
            scene.add(model);
            objectsRef.current.set(obj.id, model);
            console.log(`🎯 Добавлена: ${obj.name}`);
          }
        } catch (error) {
          console.error(`❌ Ошибка загрузки ${obj.name}:`, error);
        } finally {
          pendingObjectsRef.current.delete(obj.id);
        }
      }

      await processLoadQueue();
    })();
  }, [objects]);


  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const container = containerRef.current;

    const dragPoint = new THREE.Vector3();

    const onKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (stateRef.current.isRotating) {
        stateRef.current.cameraControl.theta -= event.movementX * 0.005;
        stateRef.current.cameraControl.phi -= event.movementY * 0.005;
        stateRef.current.cameraControl.phi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, stateRef.current.cameraControl.phi)
        );
      }

      if (
        stateRef.current.isDraggingHandle &&
        stateRef.current.draggedHandleData &&
        handleManagerRef.current
      ) {
        const data = stateRef.current.draggedHandleData;
        const selectedMesh = objectsRef.current.get(data.objectId);
        if (selectedMesh) {
          raycasterRef.current.setFromCamera(mouseRef.current, camera);
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
          raycasterRef.current.ray.intersectPlane(groundPlane, dragPoint);

          const dragVector = dragPoint.clone().sub(data.startPoint);
          const newScale = handleManagerRef.current.calculateNewScale(data, dragVector);

          selectedMesh.scale.copy(newScale);
          selectedMesh.updateMatrix();
          selectedMesh.updateMatrixWorld(true);

          if (onObjectUpdate && data.objectId) {
            onObjectUpdate(data.objectId, {
              scaleX: newScale.x,
              scaleY: newScale.y,
            });
          }

          const boundingBox = new THREE.Box3().setFromObject(selectedMesh);
          const center = boundingBox.getCenter(new THREE.Vector3());
          const size = boundingBox.getSize(new THREE.Vector3());
          handleManagerRef.current.updateHandles(data.objectId, center, size);
        }
      }

      if (
        stateRef.current.isDragging &&
        stateRef.current.selectedObjectId &&
        !stateRef.current.isDraggingHandle
      ) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const selectedMesh = objectsRef.current.get(stateRef.current.selectedObjectId);
        if (selectedMesh) {
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
          raycasterRef.current.ray.intersectPlane(groundPlane, dragPoint);

          selectedMesh.position.set(dragPoint.x, 1, dragPoint.z);
          selectedMesh.updateMatrix();
          selectedMesh.updateMatrixWorld(true);

          if (onObjectUpdate) {
            const { x: x2d, y: y2d } = world3DToCanvas2D(dragPoint.x, dragPoint.z);
            onObjectUpdate(stateRef.current.selectedObjectId, {
              x: x2d,
              y: y2d,
            });
          }
        }
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (event.button === 2) {
        stateRef.current.isRotating = true;
        return;
      }

      if (event.button === 0) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);

        if (handleManagerRef.current) {
          const handleIntersects = raycasterRef.current.intersectObjects(
            Array.from(handleManagerRef.current.handles.values())
          );

          if (handleIntersects.length > 0) {
            const clickedHandle = handleIntersects[0].object as THREE.Mesh;
            const handleId = clickedHandle.userData?.handleId;
            const objectId = clickedHandle.userData?.objectId;
            const axis = clickedHandle.userData?.axis as 'x' | 'y' | 'z';

            if (handleId && objectId) {
              stateRef.current.isDraggingHandle = true;

              const objectMesh = objectsRef.current.get(objectId);
              let center = new THREE.Vector3();
              if (objectMesh) {
                const box = new THREE.Box3().setFromObject(objectMesh);
                center = box.getCenter(new THREE.Vector3());
              }

              stateRef.current.draggedHandleData = {
                objectId,
                handleId,
                axis,
                startPoint: clickedHandle.position.clone(),
                startScale: objectsRef.current.get(objectId)?.scale.clone() || new THREE.Vector3(1, 1, 1),
                center,
              };

              return;
            }
          }
        }

        const intersects = raycasterRef.current.intersectObjects(
          Array.from(objectsRef.current.values()),
          true
        );

        if (intersects.length > 0) {
          const clicked = intersects[0].object as THREE.Mesh;
          const id = clicked.userData?.objectId || (clicked.parent as any)?.userData?.objectId;

          if (id) {
            stateRef.current.selectedObjectId = id;
            setSelectedObjectId(id);
            if (onObjectSelect) onObjectSelect(id);
            stateRef.current.isDragging = true;
          }
        }
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 2) stateRef.current.isRotating = false;
      if (event.button === 0) {
        if (stateRef.current.isDraggingHandle) {
          stateRef.current.isDraggingHandle = false;
          stateRef.current.draggedHandleData = null;
        } else {
          stateRef.current.isDragging = false;
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const control = stateRef.current.cameraControl;
      control.radius = Math.max(5, Math.min(30, control.radius + event.deltaY * 0.01));
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const animate = () => {
      requestAnimationFrame(animate);

      const control = stateRef.current.cameraControl;
      const moveSpeed = 0.1;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
        const direction = new THREE.Vector3(
          Math.sin(control.theta) * Math.sin(control.phi),
          Math.cos(control.phi),
          Math.cos(control.theta) * Math.sin(control.phi)
        ).normalize();
        control.target.add(direction.multiplyScalar(moveSpeed));
      }

      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
        const direction = new THREE.Vector3(
          Math.sin(control.theta) * Math.sin(control.phi),
          Math.cos(control.phi),
          Math.cos(control.theta) * Math.sin(control.phi)
        ).normalize();
        control.target.sub(direction.multiplyScalar(moveSpeed));
      }

      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        const rightDirection = new THREE.Vector3(
          Math.cos(control.theta),
          0,
          -Math.sin(control.theta)
        ).normalize();
        control.target.sub(rightDirection.multiplyScalar(moveSpeed));
      }

      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        const rightDirection = new THREE.Vector3(
          Math.cos(control.theta),
          0,
          -Math.sin(control.theta)
        ).normalize();
        control.target.add(rightDirection.multiplyScalar(moveSpeed));
      }

      const cameraPos = new THREE.Vector3(
        control.target.x + control.radius * Math.sin(control.theta) * Math.sin(control.phi),
        control.target.y + control.radius * Math.cos(control.phi),
        control.target.z + control.radius * Math.cos(control.theta) * Math.sin(control.phi)
      );

      camera.position.copy(cameraPos);
      camera.lookAt(control.target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onObjectSelect, onObjectUpdate]);

  const [showControls, setShowControls] = useState(true);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
      }}
    >
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            zIndex: 10,
            maxWidth: '250px',
            fontFamily: 'monospace',
          }}
        >
          <button
            onClick={() => setShowControls(false)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#fff')}
            title="Закрыть"
          >
            ✕
          </button>

          <div style={{ paddingRight: '24px' }}>
            <strong>🎮 Управление:</strong>
            <div>⬅️➡️⬆️⬇️ / W A S D - движение</div>
            <div>🖱️ ПКМ + движение - вращение</div>
            <div>🖱️ ЛКМ - переместить объект</div>
            <div>🔍 Колесико - приблизить/отдалить</div>
            <div style={{ marginTop: '8px' }}>
              <strong>📏 Handles:</strong>
            </div>
            <div>🔴 Красный - растяжение X</div>
            <div>🟢 Зеленый - растяжение Y</div>
            <div>🔵 Синий - растяжение Z</div>
          </div>

          {selectedObjectId && (
            <div style={{ marginTop: '12px', color: '#4ade80' }}>
              ✓ Объект выбран
            </div>
          )}
        </div>
      )}
    </div>
  );
};