// HandleManager.tsx - ФИНАЛЬНАЯ ВЕРСИЯ с НЕЖНОЙ чувствительностью

import * as THREE from 'three';

export interface HandleDefinition {
  id: string;
  position: THREE.Vector3;
  axis: 'x' | 'y' | 'z';
  color: number;
}

export interface DraggedHandleData {
  objectId: string;
  handleId: string;
  axis: 'x' | 'y' | 'z';
  startPoint: THREE.Vector3;
  startScale: THREE.Vector3;
  center: THREE.Vector3;
}

export class HandleManager {
  public handles: Map<string, THREE.Mesh> = new Map();
  private scene: THREE.Scene;
  private handleLines: Map<string, THREE.Line> = new Map();
  private currentObjectId: string | null = null;
  private initialHandleSize: number = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createHandles(objectId: string, position: THREE.Vector3, scale: THREE.Vector3): HandleDefinition[] {
    this.removeAllHandles();
    this.currentObjectId = objectId;

    const size = scale;
    const offset = 2.5;

    const handleDefinitions: HandleDefinition[] = [
      { id: `${objectId}-x+`, position: position.clone().add(new THREE.Vector3((size.x / 2) * offset, 0, 0)), axis: 'x', color: 0xff0000 },
      { id: `${objectId}-x-`, position: position.clone().add(new THREE.Vector3((-size.x / 2) * offset, 0, 0)), axis: 'x', color: 0xff0000 },
      { id: `${objectId}-y+`, position: position.clone().add(new THREE.Vector3(0, (size.y / 2) * offset, 0)), axis: 'y', color: 0x00ff00 },
      { id: `${objectId}-y-`, position: position.clone().add(new THREE.Vector3(0, (-size.y / 2) * offset, 0)), axis: 'y', color: 0x00ff00 },
      { id: `${objectId}-z+`, position: position.clone().add(new THREE.Vector3(0, 0, (size.z / 2) * offset)), axis: 'z', color: 0x0000ff },
      { id: `${objectId}-z-`, position: position.clone().add(new THREE.Vector3(0, 0, (-size.z / 2) * offset)), axis: 'z', color: 0x0000ff },
    ];

    const avgDim = (size.x + size.y + size.z) / 3;
    this.initialHandleSize = Math.max(0.1, Math.min(avgDim, 5) * 0.08);

    handleDefinitions.forEach((def) => {
      const geometry = new THREE.SphereGeometry(this.initialHandleSize, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.6,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(def.position);
      sphere.renderOrder = 999;
      sphere.scale.set(1, 1, 1);

      sphere.userData = { 
        handleId: def.id, 
        objectId: objectId, 
        axis: def.axis, 
        isHandle: true 
      };

      this.scene.add(sphere);
      this.handles.set(def.id, sphere);
      this.createHandleLine(objectId, position, def);
    });

    return handleDefinitions;
  }

  private createHandleLine(objectId: string, centerPosition: THREE.Vector3, handle: HandleDefinition): void {
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: handle.color, 
      transparent: true, 
      opacity: 0.5,
      depthTest: false
    });
    
    const points = [centerPosition.clone(), handle.position.clone()];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = 998;
    
    this.scene.add(line);
    this.handleLines.set(`line-${handle.id}`, line);
  }

  updateHandles(objectId: string, position: THREE.Vector3, scale: THREE.Vector3): void {
    if (this.currentObjectId !== objectId) return;

    const offset = 2.5;
    const axisOffsets: { [key: string]: THREE.Vector3 } = {
      'x+': new THREE.Vector3((scale.x / 2) * offset, 0, 0),
      'x-': new THREE.Vector3((-scale.x / 2) * offset, 0, 0),
      'y+': new THREE.Vector3(0, (scale.y / 2) * offset, 0),
      'y-': new THREE.Vector3(0, (-scale.y / 2) * offset, 0),
      'z+': new THREE.Vector3(0, 0, (scale.z / 2) * offset),
      'z-': new THREE.Vector3(0, 0, (-scale.z / 2) * offset),
    };

    const avgDim = (scale.x + scale.y + scale.z) / 3;
    const targetHandleSize = Math.max(0.1, Math.min(avgDim, 5) * 0.08);
    const scaleFactor = targetHandleSize / this.initialHandleSize;

    Object.entries(axisOffsets).forEach(([suffix, offsetVec]) => {
      const handleId = `${objectId}-${suffix}`;
      const handle = this.handles.get(handleId);
      if (handle) {
        handle.position.copy(position).add(offsetVec);
        handle.scale.setScalar(scaleFactor);
      }
    });

    this.handles.forEach((handle, handleId) => {
      const line = this.handleLines.get(`line-${handleId}`);
      if (line) {
        const positions = line.geometry.attributes.position.array as Float32Array;
        positions[0] = position.x;
        positions[1] = position.y;
        positions[2] = position.z;
        positions[3] = handle.position.x;
        positions[4] = handle.position.y;
        positions[5] = handle.position.z;
        line.geometry.attributes.position.needsUpdate = true;
      }
    });
  }

  /**
   * 🎚️ НЕЖНОЕ масштабирование - вы можете менять SENSITIVITY
   */
  calculateNewScale(data: DraggedHandleData, dragVector: THREE.Vector3): THREE.Vector3 {
    const startVector = data.startPoint.clone().sub(data.center);
    const startDistance = startVector.length();

    if (startDistance < 0.0001) return data.startScale;

    const axisVector = new THREE.Vector3(
      data.axis === 'x' ? 1 : 0,
      data.axis === 'y' ? 1 : 0,
      data.axis === 'z' ? 1 : 0
    );

    const dragAmount = dragVector.dot(axisVector);

    // 🎚️ ЧУВСТВИТЕЛЬНОСТЬ: чем больше число, тем нежнее увеличение
    // 2 = очень агрессивно (ТЕКУЩЕЕ)
    // 4 = умеренно
    // 6 = мягко
    // 8 = очень мягко
    const SENSITIVITY = 6; // ← ИЗМЕНИТЕ ЗДЕСЬ! От 2 до 10+

    const ratio = 1 + dragAmount / (startDistance * SENSITIVITY);

    const newScale = data.startScale.clone();
    
    if (data.axis === 'x') newScale.x *= ratio;
    if (data.axis === 'y') newScale.y *= ratio;
    if (data.axis === 'z') newScale.z *= ratio;

    const MIN = 0.05;
    const MAX = 100;
    
    newScale.x = Math.max(MIN, Math.min(MAX, newScale.x));
    newScale.y = Math.max(MIN, Math.min(MAX, newScale.y));
    newScale.z = Math.max(MIN, Math.min(MAX, newScale.z));

    return newScale;
  }

  removeAllHandles(): void {
    this.handles.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });
    this.handles.clear();
    
    this.handleLines.forEach((line) => {
      this.scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) line.material.dispose();
    });
    this.handleLines.clear();
    this.currentObjectId = null;
  }

  dispose(): void {
    this.removeAllHandles();
  }
}