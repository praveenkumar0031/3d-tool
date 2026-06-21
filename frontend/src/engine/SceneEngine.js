// engine/SceneEngine.js
// Owns the entire Three.js world: scene graph, voxel lifecycle, gravity
// simulation, and the render loop. Has zero React dependency — it's
// constructed with a canvas and torn down with .dispose(), so it can be
// tested or reused outside this app.

import * as THREE from 'three';
import { GRID_SIZE, COLOR_PALETTE } from '../constants';
import { getFloorY, voxelKey } from '../utils/math';

export class SceneEngine {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 20;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    this.sketchGroup = new THREE.Group();
    this.voxelGroup.add(this.sketchGroup);

    this.placedVoxels = new Map();
    this.sketchKeys = new Set();

    this.crosshair = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.5 })
    );
    this.crosshair.visible = false;
    this.scene.add(this.crosshair);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 5, 5);
    this.scene.add(sun);

    this.colorIndex = 0;
    this.gravityEnabled = false;
    this.rainbowActive = false;

    this._animationFrameId = null;
    this._onResize = () => this.handleResize();
    window.addEventListener('resize', this._onResize);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  get activeColor() {
    return COLOR_PALETTE[this.colorIndex];
  }

  cycleColor() {
    this.colorIndex = (this.colorIndex + 1) % COLOR_PALETTE.length;
  }

  // --- Voxel sketch (preview) lifecycle ---

  addSketchVoxel(x, y, z) {
    const key = voxelKey(x, y, z);
    if (this.sketchKeys.has(key) || this.placedVoxels.has(key)) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_SIZE * 0.98, GRID_SIZE * 0.98, GRID_SIZE * 0.98),
      new THREE.MeshBasicMaterial({ color: this.activeColor, wireframe: true })
    );
    mesh.position.set(x, y, z);
    this.sketchGroup.add(mesh);
    this.sketchKeys.add(key);
  }

  clearSketchKeys() {
    this.sketchKeys.clear();
  }

  _createFinalCube(x, y, z) {
    const geometry = new THREE.BoxGeometry(GRID_SIZE * 0.95, GRID_SIZE * 0.95, GRID_SIZE * 0.95);
    const material = new THREE.MeshPhongMaterial({
      color: 0x001122,
      emissive: this.activeColor,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.origin = new THREE.Vector3(x, y, z);
    mesh.velocity = new THREE.Vector3(0, 0, 0);
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: this.activeColor })
      )
    );
    return mesh;
  }

  /** Converts every sketch (wireframe preview) voxel into a placed, lit voxel. */
  commitSketch(onCountChange) {
    while (this.sketchGroup.children.length > 0) {
      const sketchMesh = this.sketchGroup.children[0];
      const key = voxelKey(sketchMesh.position.x, sketchMesh.position.y, sketchMesh.position.z);
      const cube = this._createFinalCube(sketchMesh.position.x, sketchMesh.position.y, sketchMesh.position.z);
      this.voxelGroup.add(cube);
      this.placedVoxels.set(key, cube);
      this.sketchGroup.remove(sketchMesh);
    }
    onCountChange?.(this.placedVoxels.size);
  }

  eraseVoxelAt(x, y, z, onCountChange) {
    const key = voxelKey(x, y, z);
    if (!this.placedVoxels.has(key)) return false;
    this.voxelGroup.remove(this.placedVoxels.get(key));
    this.placedVoxels.delete(key);
    onCountChange?.(this.placedVoxels.size);
    return true;
  }

  // --- Crosshair (gesture cursor in 3D space) ---

  showCrosshair(worldPos, isErasing) {
    this.crosshair.visible = true;
    this.crosshair.position.copy(worldPos);
    this.crosshair.material.color.set(isErasing ? 0xff3333 : this.activeColor);
  }

  hideCrosshair() {
    this.crosshair.visible = false;
  }

  // --- Whole-structure transforms (grab / rotate / reset) ---

  setGroupPosition(vec3) {
    this.voxelGroup.position.copy(vec3);
  }

  rotateGroup(dx, dy) {
    this.voxelGroup.rotation.y += dx * 0.05;
    this.voxelGroup.rotation.x += dy * 0.05;
  }

  resetTransform() {
    this.voxelGroup.position.set(0, 0, 0);
    this.voxelGroup.rotation.set(0, 0, 0);
  }

  // --- Gravity / disco effects ---

  triggerGravity() {
    this.gravityEnabled = true;
    this.placedVoxels.forEach((v) => {
      v.velocity.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
      v.isBouncing = false;
    });
  }

  restoreGravity() {
    this.gravityEnabled = false;
  }

  toggleRainbow(force) {
    this.rainbowActive = force ?? !this.rainbowActive;
  }

  // --- Render loop ---

  start() {
    const animate = () => {
      this._animationFrameId = requestAnimationFrame(animate);
      this._tickMaterials();
      this._tickPhysics();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  _tickMaterials() {
    if (this.rainbowActive) {
      this.placedVoxels.forEach((v) => {
        v.material.emissive.setHSL(Math.random(), 1, 0.5);
        v.material.emissiveIntensity = 2.5;
      });
    } else {
      this.placedVoxels.forEach((v) => {
        v.material.emissive.setHex(this.activeColor);
        v.material.emissiveIntensity = 0.4;
        v.children[0].material.color.setHex(this.activeColor);
      });
    }
  }

  _tickPhysics() {
    const floorY = getFloorY(this.camera, GRID_SIZE);
    this.placedVoxels.forEach((v) => {
      if (this.gravityEnabled) {
        const worldPos = new THREE.Vector3();
        v.getWorldPosition(worldPos);
        if (worldPos.y > floorY || v.velocity.y > 0) {
          v.velocity.y -= 0.025;
          v.position.add(v.velocity);
        } else if (!v.isBouncing) {
          const localFloor = this.voxelGroup.worldToLocal(new THREE.Vector3(0, floorY, 0));
          v.position.y = localFloor.y;
          v.velocity.y *= -0.15;
          v.velocity.x *= 0.5;
          v.isBouncing = true;
        } else {
          v.velocity.set(0, 0, 0);
        }
      } else {
        v.position.lerp(v.origin, 0.1);
        v.isBouncing = false;
      }
    });
  }

  dispose() {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
