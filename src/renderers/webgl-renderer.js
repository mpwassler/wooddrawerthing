/**
 * @fileoverview WebGL Renderer (Three.js)
 * Implements the Renderer Interface using Three.js for hardware-accelerated 2D/3D graphics.
 */

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export class WebGLRenderer {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.width = canvasElement.clientWidth;
        this.height = canvasElement.clientHeight;

        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        // 2D Camera (Orthographic)
        this.cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.cameraOrtho.position.z = 10;

        // 3D Camera (Perspective)
        this.cameraPersp = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 10000);
        this.cameraPersp.position.set(0, -50, 50); // Look from angle
        this.cameraPersp.up.set(0, 0, 1); // Z is up

        // Active Camera
        this.activeCamera = this.cameraOrtho;
        this.mode = '2D';

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true 
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        // Controls (Orbit)
        this.controls = new OrbitControls(this.cameraPersp, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enabled = false; // Disabled in 2D

        // Lighting (for 3D)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(50, -50, 100);
        this.dirLight.castShadow = true;
        this.scene.add(this.ambientLight);
        this.scene.add(this.dirLight);
        // Hide lights in 2D? No, they don't affect LineBasicMaterial.

        // State for Transforms
        this.transformStack = [];
        this.currentTransform = { x: 0, y: 0, scale: 1 };
        
        // Caches
        this.materials = new Map();
        this.activeObjects = [];
        this.extrudedMeshes = []; // Keep track of 3D objects
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === '3D') {
            this.activeCamera = this.cameraPersp;
            this.controls.enabled = true;
            
            // Calculate center of shapes to target controls?
            // For now, look at origin
            this.controls.target.set(this.width/2, this.height/2, 0); 
            this.cameraPersp.position.set(this.width/2, this.height/2 + 100, 100);
            this.cameraPersp.lookAt(this.width/2, this.height/2, 0);
            this.controls.update();

        } else {
            this.activeCamera = this.cameraOrtho;
            this.controls.enabled = false;
            // Clear 3D meshes when going back to 2D
            this.clear3D();
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.renderer.setSize(width, height);
        
        // Update Ortho
        this.cameraOrtho.left = 0;
        this.cameraOrtho.right = this.width;
        this.cameraOrtho.top = 0;
        this.cameraOrtho.bottom = this.height;
        this.cameraOrtho.updateProjectionMatrix();
        
        // Update Persp
        this.cameraPersp.aspect = this.width / this.height;
        this.cameraPersp.updateProjectionMatrix();
    }
    
    clear() {
        // Clear 2D immediate objects
        this.activeObjects.forEach(obj => this.scene.remove(obj));
        this.activeObjects = [];
    }

    clear3D() {
        this.extrudedMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            // Don't dispose material as it is cached/shared
        });
        this.extrudedMeshes = [];
    }

    pushWorldTransform(tx, ty, s) {
        this.transformStack.push({ ...this.currentTransform });
        this.currentTransform = { x: tx, y: ty, scale: s };
    }

    popTransform() {
        const t = this.transformStack.pop();
        if (t) this.currentTransform = t;
    }
    
    _getMaterial(color, width = 1) {
        const key = `${color}-${width}`;
        if (!this.materials.has(key)) {
            const mat = new THREE.LineBasicMaterial({ color: color, linewidth: width });
            this.materials.set(key, mat);
        }
        return this.materials.get(key);
    }
    
    _getMeshMaterial(color) {
        const key = `mesh-${this.mode}-${color}`;
        if (!this.materials.has(key)) {
            const isRgba = color.startsWith('rgba');
            let opacity = 1;
            let hexColor = color;

            if (isRgba) {
                const parts = color.match(/[\d.]+/g);
                if (parts && parts.length === 4) {
                    hexColor = `rgb(${parts[0]},${parts[1]},${parts[2]})`;
                    opacity = parseFloat(parts[3]);
                }
            }

            let mat;
            if (this.mode === '3D') {
                mat = new THREE.MeshPhongMaterial({ 
                    color: hexColor, 
                    side: THREE.DoubleSide,
                    shininess: 30,
                    transparent: opacity < 1,
                    opacity: opacity
                });
            } else {
                mat = new THREE.MeshBasicMaterial({ 
                    color: hexColor, 
                    side: THREE.DoubleSide,
                    transparent: opacity < 1,
                    opacity: opacity
                });
            }
            this.materials.set(key, mat);
        }
        return this.materials.get(key);
    }

    // --- 2D PRIMITIVES ---

    drawGrid(bounds, step, color, lineWidth) {
        if (this.mode === '3D') return; // Don't draw 2D grid in 3D mode (or maybe draw a ground plane later)

        const startX = Math.floor(bounds.left / step) * step;
        const startY = Math.floor(bounds.top / step) * step;
        
        const positions = [];
        for (let x = startX; x < bounds.right; x += step) {
             positions.push(x, bounds.top, 0);
             positions.push(x, bounds.bottom, 0);
        }
        for (let y = startY; y < bounds.bottom; y += step) {
            positions.push(bounds.left, y, 0);
            positions.push(bounds.right, y, 0);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = this._getMaterial(color, lineWidth);
        const segments = new THREE.LineSegments(geometry, material);
        
        this._addObject(segments);
    }

    drawLine(start, end, color, width, dash = []) {
        if (!start || !end) return;
        const geometry = new THREE.BufferGeometry();
        const positions = [start.x, start.y, 0, end.x, end.y, 0];
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = this._getMaterial(color, width);
        const line = new THREE.Line(geometry, material);
        this._addObject(line);
    }

    drawPolygon(points, fillColor) {
        if (points.length < 3) return;
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].y);
        }
        const geometry = new THREE.ShapeGeometry(shape);
        const material = this._getMeshMaterial(fillColor);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = -0.1; 
        this._addObject(mesh);
    }

    _addObject(obj) {
        obj.position.x = (obj.position.x * this.currentTransform.scale) + this.currentTransform.x;
        obj.position.y = (obj.position.y * this.currentTransform.scale) + this.currentTransform.y;
        obj.scale.set(this.currentTransform.scale, this.currentTransform.scale, 1);
        this.scene.add(obj);
        this.activeObjects.push(obj);
    }

    // --- 3D LOGIC ---

    render3DScene(shapes) {
        // Only rebuild scene if shape count changed? 
        // For prototype, we clear and rebuild every frame which is safe but not performant.
        // Actually, render3DScene is called every frame.
        // We should NOT rebuild the geometry every frame. That kills performance.
        
        // Hack: We only need to build it once when entering 3D mode, or when shapes change.
        // But `ViewController.render()` calls this every loop.
        
        // Let's check if we already have meshes. If yes, assume they are up to date 
        // (unless we implement a dirty flag, but let's just build ONCE on mode switch in script.js? 
        // No, script.js calls this every frame).
        
        // Improved Strategy:
        // We check if `this.extrudedMeshes` is empty. If so, build.
        // If not, just let them sit there.
        // Since `setMode('2D')` clears them, this works for switching back and forth.
        // If the user modifies shapes in 2D, they are cleared.
        // Wait, if I change thickness in 3D (which I can't yet because UI is hidden), I'd need to rebuild.
        
        if (this.extrudedMeshes.length > 0) return; // Already built

        // 1. Grid (Ground Plane)
        const grid = new THREE.GridHelper(1000, 100);
        grid.rotation.x = Math.PI / 2; // Rotate to match X/Y plane
        this.scene.add(grid);
        this.extrudedMeshes.push(grid);

        // 2. Extrude Shapes
        const scale = 10; // 10 pixels per inch
        const bounds = new THREE.Box3();
        let hasShapes = false;
        
        shapes.forEach(shapeData => {
            if (!shapeData.closed || shapeData.points.length < 3) return;

            const shape = new THREE.Shape();
            shape.moveTo(shapeData.points[0].x, shapeData.points[0].y);
            for (let i = 1; i < shapeData.points.length; i++) {
                shape.lineTo(shapeData.points[i].x, shapeData.points[i].y);
            }
            
            // Add Holes (Cutouts)
            if (shapeData.cutouts && shapeData.cutouts.length > 0) {
                const startPt = shapeData.points[0];
                const scale = 10; // Match global scale (unfortunately duplicated literal here, should pass config)
                
                shapeData.cutouts.forEach(c => {
                    const holePath = new THREE.Path();
                    // Cutout coords are relative to startPt in inches.
                    // World X = startPt.x + c.x * scale
                    const hx = startPt.x + c.x * scale;
                    const hy = startPt.y + c.y * scale;
                    const hw = c.w * scale;
                    const hh = c.h * scale;
                    
                    // Define hole path (Counter-Clockwise for holes usually, but Three.js handles simple shapes)
                    holePath.moveTo(hx, hy);
                    holePath.lineTo(hx + hw, hy);
                    holePath.lineTo(hx + hw, hy + hh);
                    holePath.lineTo(hx, hy + hh);
                    holePath.lineTo(hx, hy); // Close
                    
                    shape.holes.push(holePath);
                });
            }

            const thicknessPixels = (shapeData.thickness || 0.75) * scale;
            
            const extrudeSettings = {
                steps: 1,
                depth: thicknessPixels,
                bevelEnabled: true,
                bevelThickness: 1,
                bevelSize: 1,
                bevelSegments: 2
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            const material = this._getMeshMaterial('#e0c097'); // Wood color
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.scale.y = -1;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.extrudedMeshes.push(mesh);
            
            // --- Tenons (Additive) ---
            if (shapeData.tenons && shapeData.tenons.length > 0) {
                const startPt = shapeData.points[0];
                shapeData.tenons.forEach(t => {
                    const tShape = new THREE.Shape();
                    const tx = startPt.x + t.x * scale;
                    const ty = startPt.y + t.y * scale;
                    const tw = t.w * scale;
                    const th = t.h * scale;
                    
                    tShape.moveTo(tx, ty);
                    tShape.lineTo(tx + tw, ty);
                    tShape.lineTo(tx + tw, ty + th);
                    tShape.lineTo(tx, ty + th);
                    tShape.lineTo(tx, ty);
                    
                    // Calculate Tenon Depth based on Inset
                    // Board Depth = thicknessPixels
                    // Tenon Depth = thicknessPixels - (2 * inset * scale)
                    const insetPixels = (t.inset || 0) * scale;
                    const tenonDepth = Math.max(1, thicknessPixels - (insetPixels * 2));
                    
                    const tSettings = { ...extrudeSettings, depth: tenonDepth };
                    const tGeom = new THREE.ExtrudeGeometry(tShape, tSettings);
                    const tMesh = new THREE.Mesh(tGeom, material);
                    
                    tMesh.scale.y = -1;
                    tMesh.castShadow = true;
                    tMesh.receiveShadow = true;
                    
                    // Position Z to center it
                    // Board is 0 to Depth.
                    // Tenon should be Inset to Depth-Inset.
                    tMesh.position.z = insetPixels;
                    
                    this.scene.add(tMesh);
                    this.extrudedMeshes.push(tMesh);
                    
                    // Update bounds for camera centering
                    tGeom.computeBoundingBox();
                    const tBounds = tGeom.boundingBox.clone();
                    // Apply transforms
                    tBounds.min.y *= -1;
                    tBounds.max.y *= -1;
                    const tmpT = tBounds.min.y;
                    tBounds.min.y = tBounds.max.y;
                    tBounds.max.y = tmpT;
                    tBounds.min.z += insetPixels;
                    tBounds.max.z += insetPixels;
                    
                    bounds.union(tBounds);
                });
            }
            
            // Update Bounds (Main Mesh)
            geometry.computeBoundingBox();
            const meshBounds = geometry.boundingBox.clone();
            // Apply the Y flip to the bounds
            meshBounds.min.y *= -1;
            meshBounds.max.y *= -1;
            // Since we flipped, min becomes max, swap them
            const tmp = meshBounds.min.y;
            meshBounds.min.y = meshBounds.max.y;
            meshBounds.max.y = tmp;
            
            bounds.union(meshBounds);
            hasShapes = true;
        });

        // Center Camera
        if (hasShapes) {
            const center = new THREE.Vector3();
            bounds.getCenter(center);
            const size = new THREE.Vector3();
            bounds.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // Adjust Grid position to be "under" the lowest point
            grid.position.z = bounds.min.z;
            grid.position.x = center.x;
            grid.position.y = center.y;

            // Move camera
            const dist = maxDim * 1.5; // Zoom factor
            this.controls.target.copy(center);
            // Position camera at an isometric-like angle
            this.cameraPersp.position.set(center.x + dist, center.y + dist, center.z + dist);
            this.controls.update();
        }
    }
    
    render() {
        if (this.mode === '3D') {
            this.controls.update();
        }
        this.renderer.render(this.scene, this.activeCamera);
    }
}