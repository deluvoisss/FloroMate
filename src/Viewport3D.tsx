import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

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

interface Viewport3DProps {
  objects: SceneObject[];
  backgroundColor: string;
  groundType: 'grass' | 'asphalt' | 'sand' | 'soil' | 'water';
  showGrid: boolean;
  onObjectSelect?: (objectId: string) => void;
  onObjectUpdate?: (objectId: string, updates: Partial<SceneObject>) => void;
}

const MODEL_PATHS: { [key: string]: string } = {
  'home': '/treeModels/home.glb',
  'house': '/treeModels/home.glb',
  'home1': '/treeModels/home1.glb',
  'house1': '/treeModels/home1.glb',
  'home2': '/treeModels/modern.glb',
  'house2': '/treeModels/modern.glb',
  'home3': '/treeModels/country.glb',
  'house3': '/treeModels/country.glb',
  'tree': '/treeModels/trees.glb',
};

const GROUND_COLORS: Record<string, number> = {
  grass: 0x7cb342,
  asphalt: 0x505050,
  sand: 0xf2e394,
  soil: 0x9b7653,
  water: 0x4da6ff,
};

function loadModel(path: string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    const modelLoader = new GLTFLoader();
    modelLoader.load(path, (gltf: GLTF) => {
      resolve(gltf.scene);
    }, undefined, reject);
  });
}

function applyColorToModel(model: THREE.Object3D, color: string) {
  const threeColor = new THREE.Color(color);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial) {
            mat.color.set(threeColor);
          }
        });
      } else {
        const mat = child.material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
        if (mat) {
          mat.color.set(threeColor);
        }
      }
    }
  });
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  objects,
  backgroundColor,
  groundType,
  showGrid,
  onObjectSelect,
  onObjectUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const groundRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const stateRef = useRef({
    isRotating: false,
    isDragging: false,
    selectedObjectId: null as string | null,
    cameraControl: {
      theta: 0,
      phi: Math.PI / 4,
      radius: 15,
      target: new THREE.Vector3(0, 2, 0),
    },
  });

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // ===== 1. ИНИЦИАЛИЗАЦИЯ СЦЕНЫ (один раз) =====
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

    // Земля с цветом из groundType
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundColor = GROUND_COLORS[groundType] || GROUND_COLORS.grass;
    const groundMaterial = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    // Сетка (если showGrid === true)
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(30, 60, 0xcccccc, 0xeeeeee);
      gridHelper.position.y = 0.01;
      scene.add(gridHelper);
      gridRef.current = gridHelper;
    }

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
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [backgroundColor, groundType, showGrid]);

  // ===== 2. ОБНОВЛЕНИЕ ЦВЕТА ЗЕМЛИ ПРИ ИЗМЕНЕНИИ groundType =====
  useEffect(() => {
    if (groundRef.current) {
      const groundColor = GROUND_COLORS[groundType] || GROUND_COLORS.grass;
      (groundRef.current.material as THREE.MeshLambertMaterial).color.set(groundColor);
    }
  }, [groundType]);

  // ===== 3. УПРАВЛЕНИЕ ВИДИМОСТЬЮ СЕТКИ ПРИ ИЗМЕНЕНИИ showGrid =====
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (showGrid && !gridRef.current) {
      const gridHelper = new THREE.GridHelper(30, 60, 0xcccccc, 0xeeeeee);
      gridHelper.position.y = 0.01;
      scene.add(gridHelper);
      gridRef.current = gridHelper;
    } else if (!showGrid && gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current = null;
    }
  }, [showGrid]);

  // ===== 4. ОБНОВЛЕНИЕ ОБЪЕКТОВ (когда меняются objects) =====
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    const create3DObject = (obj: SceneObject): THREE.Object3D => {
      const modelKey = obj.name.toLowerCase();

      if (MODEL_PATHS[modelKey] && !objectsRef.current.has(obj.id)) {
        loadModel(MODEL_PATHS[modelKey])
          .then((model) => {
            model.position.set(obj.x / 150, 0.5, obj.y / 150);
            model.rotation.y = (obj.rotation * Math.PI) / 180;

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = (7 / maxDim) * 1.4;
            model.scale.set(scale, scale, scale);

            (model as any).userData = { objectId: obj.id };
            model.frustumCulled = false;
            model.traverse((child) => {
              (child as any).userData = { objectId: obj.id };
              child.frustumCulled = false;
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = true;
                (child as THREE.Mesh).receiveShadow = true;
              }
            });

            // Применяем цвет к модели
            applyColorToModel(model, obj.color);

            model.updateMatrix();
            model.updateMatrixWorld(true);

            scene.add(model);
            objectsRef.current.set(obj.id, model);
          })
          .catch(console.error);
        return new THREE.Object3D();
      }

      // Примитивы
      let mesh: THREE.Mesh | THREE.Group;
      const getSize = (val: number) => val / 150;

      switch (obj.type) {
        case 'plant':
          if (obj.name.toLowerCase().includes('газон')) {
            return new THREE.Object3D();
          } else if (obj.name.toLowerCase().includes('ель')) {
            const geometry = new THREE.ConeGeometry(getSize(obj.width) * 0.4, getSize(obj.height), 8);
            const material = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.7 });
            mesh = new THREE.Mesh(geometry, material);
          } else {
            const geometry = new THREE.SphereGeometry(getSize(obj.width) * 0.4, 16, 16);
            const material = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.6 });
            mesh = new THREE.Mesh(geometry, material);
          }
          break;
        case 'furniture':
          if (obj.name.toLowerCase().includes('беседка')) {
            const group = new THREE.Group();
            const columnGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
            const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6f47 });
            [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]].forEach(([x, z]) => {
              const column = new THREE.Mesh(columnGeometry, columnMaterial);
              column.position.set(x, 0.4, z);
              column.castShadow = true;
              group.add(column);
            });
            const roofGeometry = new THREE.ConeGeometry(0.7, 0.3, 8);
            const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 1.0;
            roof.castShadow = true;
            group.add(roof);
            mesh = group;
          } else {
            const geometry = new THREE.BoxGeometry(getSize(obj.width) * 0.8, getSize(obj.height) * 0.4, getSize(obj.width) * 0.8);
            const material = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.5 });
            mesh = new THREE.Mesh(geometry, material);
          }
          break;
        case 'path':
          const pathGeometry = new THREE.BoxGeometry(getSize(obj.width), 0.05, getSize(obj.height));
          const pathMaterial = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.9 });
          mesh = new THREE.Mesh(pathGeometry, pathMaterial);
          mesh.receiveShadow = true;
          break;
        case 'water':
          const waterGeometry = new THREE.SphereGeometry(getSize(obj.width) * 0.4, 32, 32);
          const waterMaterial = new THREE.MeshStandardMaterial({ color: obj.color, metalness: 0.6, roughness: 0.2 });
          mesh = new THREE.Mesh(waterGeometry, waterMaterial);
          break;
        default:
          const defaultGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
          const defaultMaterial = new THREE.MeshStandardMaterial({ color: obj.color });
          mesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
      }

      mesh.position.set(obj.x / 150, 0.5, obj.y / 150);
      mesh.rotation.y = (obj.rotation * Math.PI) / 180;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mesh as any).userData = { objectId: obj.id };
      return mesh;
    };

    const currentIds = new Set(objects.map(o => o.id));
    [...objectsRef.current.entries()].forEach(([id, mesh]) => {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        objectsRef.current.delete(id);
      }
    });

    objects.forEach((obj) => {
      if (!objectsRef.current.has(obj.id)) {
        const mesh = create3DObject(obj);
        if (mesh.children.length > 0 || (mesh as any).geometry) {
          scene.add(mesh);
          objectsRef.current.set(obj.id, mesh);
        }
      } else {
        const mesh = objectsRef.current.get(obj.id);
        if (mesh) {
          mesh.position.set(obj.x / 150, 0.5, obj.y / 150);
          mesh.rotation.y = (obj.rotation * Math.PI) / 180;

          // Обновление цвета
          if (MODEL_PATHS[obj.name.toLowerCase()]) {
            applyColorToModel(mesh, obj.color);
          } else {
            mesh.traverse(child => {
              if (child instanceof THREE.Mesh) {
                const mat = child.material as THREE.MeshStandardMaterial;
                if (mat && mat.color) mat.color.set(obj.color);
              }
            });
          }

          mesh.updateMatrix();
          mesh.updateMatrixWorld(true);
        }
      }
    });
  }, [objects]);

  // ===== 5. АНИМАЦИЯ И ОБРАБОТЧИКИ (один раз) =====
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
        const deltaX = event.movementX * 0.005;
        const deltaY = event.movementY * 0.005;
        stateRef.current.cameraControl.theta -= deltaX;
        stateRef.current.cameraControl.phi -= deltaY;
        stateRef.current.cameraControl.phi = Math.max(0.1, Math.min(Math.PI - 0.1, stateRef.current.cameraControl.phi));
      }

      if (stateRef.current.isDragging && stateRef.current.selectedObjectId) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const selectedMesh = objectsRef.current.get(stateRef.current.selectedObjectId);
        if (selectedMesh) {
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
          raycasterRef.current.ray.intersectPlane(groundPlane, dragPoint);

          selectedMesh.position.x = dragPoint.x;
          selectedMesh.position.z = dragPoint.z;
          selectedMesh.position.y = 0.5;
          selectedMesh.updateMatrix();
          selectedMesh.updateMatrixWorld(true);

          if (onObjectUpdate) {
            onObjectUpdate(stateRef.current.selectedObjectId, {
              x: dragPoint.x * 150,
              y: dragPoint.z * 150,
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
        const allObjects = Array.from(objectsRef.current.values());
        const intersects = raycasterRef.current.intersectObjects(allObjects, true);

        if (intersects.length > 0) {
          const clicked = intersects[0].object;
          const id = (clicked as any).userData?.objectId || (clicked.parent as any)?.userData?.objectId;
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
      if (event.button === 0) stateRef.current.isDragging = false;
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const control = stateRef.current.cameraControl;
      control.radius = Math.max(5, Math.min(30, control.radius + event.deltaY * 0.01));
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9800,
      emissive: 0xff9800,
      emissiveIntensity: 0.3,
    });
    const originalMaterials = new Map<string, THREE.Material>();

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
        const rightDirection = new THREE.Vector3(Math.cos(control.theta), 0, -Math.sin(control.theta)).normalize();
        control.target.sub(rightDirection.multiplyScalar(moveSpeed));
      }

      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        const rightDirection = new THREE.Vector3(Math.cos(control.theta), 0, -Math.sin(control.theta)).normalize();
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

      objectsRef.current.forEach((mesh, id) => {
        if (id === stateRef.current.selectedObjectId) {
          if (mesh instanceof THREE.Mesh) {
            const original = originalMaterials.get(id);
            if (!original) {
              originalMaterials.set(id, mesh.material);
              mesh.material = highlightMaterial;
            }
          }
        } else {
          const original = originalMaterials.get(id);
          if (original && mesh instanceof THREE.Mesh) {
            mesh.material = original;
            originalMaterials.delete(id);
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onObjectSelect, onObjectUpdate]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        fontSize: '13px',
        zIndex: 10,
        lineHeight: '1.8',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4caf50' }}>🎮 Управление:</div>
        <div>⬅️➡️⬆️⬇️ / W A S D - движение</div>
        <div>🖱️ <strong>ПКМ</strong> + движение - вращение</div>
        <div>🖱️ ЛКМ - переместить объект</div>
        <div>🔍 Колесико - приблизить/отдалить</div>
        {selectedObjectId && <div style={{ marginTop: '8px', color: '#ffc107' }}>✓ Объект выбран</div>}
      </div>
    </div>
  );
};
