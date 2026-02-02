/**
 * @fileoverview WebGL Renderer (Three.js)
 * Implements the Renderer Interface using Three.js for hardware-accelerated 2D/3D graphics.
 */

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/TransformControls.js';
import { CONFIG } from '../core/config.js';

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

        // Transform Controls (The assembly gizmo)
        this.transformControls = new TransformControls(this.cameraPersp, this.canvas);
        this.scene.add(this.transformControls);
        
        // Listen for transform changes to update our internal STATE
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value; // Disable orbit while dragging gizmo
        });

        // Lighting (for 3D)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(50, -50, 100);
        this.dirLight.castShadow = true;
        this.scene.add(this.ambientLight);
        this.scene.add(this.dirLight);

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
            this.transformControls.enabled = true;
            this.transformControls.visible = true;
            
            this.controls.target.set(this.width/2, this.height/2, 0); 
            this.cameraPersp.position.set(this.width/2, this.height/2 + 100, 100);
            this.cameraPersp.lookAt(this.width/2, this.height/2, 0);
            this.controls.update();

        } else {
            this.activeCamera = this.cameraOrtho;
            this.controls.enabled = false;
            this.transformControls.detach();
            this.transformControls.enabled = false;
            this.transformControls.visible = false;
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
        if (this.mode === '3D') return;

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
        if (this.extrudedMeshes.length > 0) return; // Already built
        const self = this;

        const grid = new THREE.GridHelper(1000, 100);
        grid.rotation.x = Math.PI / 2;
        this.scene.add(grid);
        this.extrudedMeshes.push(grid);

        const scale = 10;
        const bounds = new THREE.Box3();
        let hasShapes = false;
        
        shapes.forEach(shapeData => {
            if (!shapeData.closed || shapeData.points.length < 3) return;

            const group = new THREE.Group();
            group.userData.shapeId = shapeData.id;

            const shape = new THREE.Shape();
            let cx = 0, cy = 0;
            shapeData.points.forEach(p => { cx += p.x; cy += p.y; });
            cx /= shapeData.points.length; cy /= shapeData.points.length;

            shape.moveTo(shapeData.points[0].x - cx, shapeData.points[0].y - cy);
            for (let i = 1; i < shapeData.points.length; i++) {
                shape.lineTo(shapeData.points[i].x - cx, shapeData.points[i].y - cy);
            }
            
                        // Add Holes (Cutouts)
            
                        if (shapeData.faceData && shapeData.faceData.FRONT && shapeData.faceData.FRONT.cutouts) {
            
                            const startPt = shapeData.points[0];
            
                            shapeData.faceData.FRONT.cutouts.forEach(c => {
            
                                // If depth is less than full thickness, it's a pocket, not a through-hole.
            
                                // For now, only through-holes are added to shape.holes.
            
                                if (c.depth >= shapeData.thickness) {
            
                                    const hPath = new THREE.Path();
            
                                    const hx = (startPt.x + c.x * scale) - cx;
            
                                    const hy = (startPt.y + c.y * scale) - cy;
            
                                    const hw = c.w * scale, hh = c.h * scale;
            
                                    hPath.moveTo(hx, hy); hPath.lineTo(hx + hw, hy);
            
                                    hPath.lineTo(hx + hw, hy + hh);
            
                                    hPath.lineTo(hx, hy + hh);
            
                                    hPath.lineTo(hx, hy);
            
                                    shape.holes.push(hPath);
            
                                }
            
                            });
            
                        }
            
            
            
                                                const thickness = (shapeData.thickness || CONFIG.DEFAULT_THICKNESS) * scale;
            
            
            
                                                const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 1, bevelSize: 1 });
            
                        const mat = this._getMeshMaterial('#e0c097');
            
                        const mainMesh = new THREE.Mesh(geom, mat);
            
                        mainMesh.scale.y = -1;
            
                        mainMesh.castShadow = true; mainMesh.receiveShadow = true;
            
                        group.add(mainMesh);
            
            
            
                        // Render Partial-Depth Cutouts (Pockets) and Tenons
            
                        const renderAddon = (item, isCutout) => {
            
                            const itemShape = new THREE.Shape();
            
                            const startPt = shapeData.points[0];
            
                            const ix = (startPt.x + item.x * scale) - cx;
            
                            const iy = (startPt.y + item.y * scale) - cy;
            
                            const iw = item.w * scale, ih = item.h * scale;
            
                            itemShape.moveTo(ix, iy); itemShape.lineTo(ix + iw, iy);
            
                            itemShape.lineTo(ix + iw, iy + ih); itemShape.lineTo(ix, iy + ih);
            
                            itemShape.lineTo(ix, iy);
            
            
            
                                            const itemDepth = (item.depth || CONFIG.DEFAULT_THICKNESS) * scale;
            
            
            
                                            const itemGeom = new THREE.ExtrudeGeometry(itemShape, { depth: itemDepth, bevelEnabled: true, bevelSize: 1 });
            
                            // Use a darker color for pockets to indicate subtraction
            
                            const itemMat = isCutout ? this._getMeshMaterial('#c0a077') : mat;
            
                            const itemMesh = new THREE.Mesh(itemGeom, itemMat);
            
                            itemMesh.scale.y = -1;
            
                            
            
                            if (isCutout) {
            
                                // Position pocket on the front surface, extruding inwards
            
                                itemMesh.position.z = 0.1; // Slightly offset to avoid flickering
            
                            } else {
            
                                // Tenon position logic
            
                                const inset = (item.inset || 0) * scale;
            
                                itemMesh.position.z = inset;
            
                            }
            
                            group.add(itemMesh);
            
                        };
            
            
            
                                    // Edges and Front additions
            
            
            
                                    Object.keys(shapeData.faceData).forEach(faceKey => {
            
            
            
                                        const data = shapeData.faceData[faceKey];
            
            
            
                                        
            
            
            
                                        // FRONT / BACK Logic
            
            
            
                                        if (faceKey === 'FRONT') {
            
            
            
                                            data.cutouts.forEach(c => { if (c.depth < shapeData.thickness) renderAddon(c, true); });
            
            
            
                                            data.tenons.forEach(t => renderAddon(t, false));
            
            
            
                                        }
            
            
            
                                        
            
            
            
                                        // EDGE Logic
            
            
            
                                        else if (faceKey.startsWith('EDGE_')) {
            
            
            
                                            const edgeIdx = parseInt(faceKey.split('_')[1]);
            
            
            
                                            const p1 = shapeData.points[edgeIdx];
            
            
            
                                            const p2 = shapeData.points[(edgeIdx + 1) % shapeData.points.length];
            
            
            
                                            
            
            
            
                                            // Edge Vector (2D)
            
            
            
                                            const dx = p2.x - p1.x;
            
            
            
                                            const dy = p2.y - p1.y;
            
            
            
                                            const len = Math.sqrt(dx*dx + dy*dy);
            
            
            
                                            const angle = Math.atan2(dy, dx);
            
            
            
                                            
            
            
            
                                            // Centroid offset
            
            
            
                                            const startX = p1.x - cx;
            
            
            
                                            const startY = p1.y - cy;
            
            
            
                        
            
            
            
                                            data.cutouts.forEach(c => renderEdgeItem(c, true, startX, startY, angle, thickness));
            
            
            
                                            data.tenons.forEach(t => renderEdgeItem(t, false, startX, startY, angle, thickness));
            
            
            
                                        }
            
            
            
                                    });
            
            
            
                        
            
            
            
                                    // Helper to render items on an edge
            
            
            
                                    function renderEdgeItem(item, isCutout, startX, startY, angle, boardThickness) {
            
            
            
                                        // 1. Create the Shape (on the local 2D plane of the edge)
            
            
            
                                        // Edge View: X = Along Edge, Y = Along Thickness (Z in 3D)
            
            
            
                                        const itemShape = new THREE.Shape();
            
            
            
                                        const ix = item.x * scale;
            
            
            
                                        const iy = item.y * scale; // This maps to Z-height in 3D
            
            
            
                                        const iw = item.w * scale;
            
            
            
                                        const ih = item.h * scale;
            
            
            
                                        
            
            
            
                                        itemShape.moveTo(ix, iy); 
            
            
            
                                        itemShape.lineTo(ix + iw, iy);
            
            
            
                                        itemShape.lineTo(ix + iw, iy + ih); 
            
            
            
                                        itemShape.lineTo(ix, iy + ih);
            
            
            
                                        itemShape.lineTo(ix, iy);
            
            
            
                        
            
            
            
                                        // 2. Extrude
            
            
            
                                        // Depth goes "Inwards" (negative normal) for cutouts, "Outwards" for tenons
            
            
            
                                        // But typically ExtrudeGeometry extrudes in +Z. We rotate the mesh to align.
            
            
            
                                        const itemDepth = (item.depth || CONFIG.DEFAULT_THICKNESS) * scale;
            
            
            
                                        const geom = new THREE.ExtrudeGeometry(itemShape, { depth: itemDepth, bevelEnabled: true, bevelSize: 1 });
            
            
            
                                        const mat = isCutout ? self._getMeshMaterial('#c0a077') : self._getMeshMaterial('#e0c097');
            
            
            
                                        const mesh = new THREE.Mesh(geom, mat);
            
            
            
                        
            
            
            
                                        // 3. Align to Edge
            
            
            
                                        // Initial: Shape is in XY plane. Extrusion is +Z.
            
            
            
                                        // Target: 
            
            
            
                                        //   - Shape's X should align with Edge Vector.
            
            
            
                                        //   - Shape's Y should align with Board Thickness (World Z).
            
            
            
                                        //   - Extrusion (+Z) should align with Edge Normal (Inward/Outward).
            
            
            
                                        
            
            
            
                                        // Rotate "Up" so the 2D Y (thickness) points to World Z
            
            
            
                                        mesh.rotation.x = Math.PI / 2; 
            
            
            
                                        
            
            
            
                                        // Now Shape X is World X, Shape Y is World -Z (oops).
            
            
            
                                        // Let's reset and construct a matrix.
            
            
            
                                        
            
            
            
                                        // Easier approach: Rotate the mesh group
            
            
            
                                        const pivot = new THREE.Group();
            
            
            
                                        
            
            
            
                                        // Move pivot to p1
            
            
            
                                        pivot.position.set(startX, startY, 0); 
            
            
            
                                        
            
            
            
                                        // Rotate pivot to align X with edge
            
            
            
                                        pivot.rotation.z = angle;
            
            
            
                                        
            
            
            
                                        // Now inside pivot: X is along edge. Y is Normal (Perpendicular). Z is Up (Thickness).
            
            
            
                                        // Our Drawing: X is along Edge. Y is Thickness.
            
            
            
                                        // We need to map Drawing Y -> Pivot Z.
            
            
            
                                        // Drawing X -> Pivot X.
            
            
            
                                        // Extrusion -> Pivot Y (Normal).
            
            
            
                                        
            
            
            
                                        mesh.rotation.x = -Math.PI / 2; // Maps Y -> Z
            
            
            
                                        // Now Extrusion is along +Y (which is Edge Normal / Perpendicular to edge)
            
            
            
                                        
            
            
            
                                        // If Cutout: We want it to go IN to the board. 
            
            
            
                                        // Board is to the "Left" of edge vector? 
            
            
            
                                        // Polygon winding is typically CCW. Normal points "Left".
            
            
            
                                        // So +Y in Pivot should be "Inwards".
            
            
            
                                        
            
            
            
                                        // Position adjustment for Tenons (Outwards)
            
            
            
                                        // Tenon Inset pushes it "Inwards" (+Y)
            
            
            
                                        // Tenon Itself should stick "Outwards" (-Y)
            
            
            
                                        
            
            
            
                                        if (isCutout) {
            
            
            
                                            // Cutout goes IN (+Y)
            
            
            
                                            // But we want visual pocket. It starts at Edge surface (Y=0) and goes to Y=Depth.
            
            
            
                                            // Just slightly offset Y to avoid z-fighting on surface
            
            
            
                                            mesh.position.y = -0.1; 
            
            
            
                                        } else {
            
            
            
                                            // Tenon goes OUT (-Y)
            
            
            
                                            // If inset is 0, it starts at 0 and goes to -Length.
            
            
            
                                            // ExtrudeGeometry goes 0 to +Depth.
            
            
            
                                            // So we rotate it 180 around X? Or just scale Y -1?
            
            
            
                                            // Let's just move it back.
            
            
            
                                            mesh.position.y = -itemDepth; 
            
            
            
                                            
            
            
            
                                            // Handle Inset (Move +Y)
            
            
            
                                            const inset = (item.inset || 0) * scale;
            
            
            
                                            mesh.position.y += inset;
            
            
            
                                        }
            
            
            
                        
            
            
            
                                        pivot.add(mesh);
            
            
            
                                        group.add(pivot);
            
            
            
                                    }

            const t3d = shapeData.transform3D || { position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} };
            group.position.set(cx + t3d.position.x, cy + t3d.position.y, t3d.position.z);
            group.rotation.set(t3d.rotation._x || t3d.rotation.x || 0, t3d.rotation._y || t3d.rotation.y || 0, t3d.rotation._z || t3d.rotation.z || 0);

            this.scene.add(group);
            this.extrudedMeshes.push(group);
            
            const groupBounds = new THREE.Box3().setFromObject(group);
            bounds.union(groupBounds);
            hasShapes = true;
        });

        if (hasShapes) {
            const center = new THREE.Vector3(); bounds.getCenter(center);
            const size = new THREE.Vector3(); bounds.getSize(size);
            const dist = Math.max(size.x, size.y, size.z) * 1.5;
            this.controls.target.copy(center);
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