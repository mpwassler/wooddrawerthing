/**
 * @fileoverview 3D Assembly Operations
 * Handles clicking, dragging, and rotating objects in the 3D layout view.
 */

import { STATE } from '../core/state.js';
import * as THREE from 'https://esm.sh/three@0.160.0';
import { DocumentOp } from './document-op.js';
import { Geometry } from '../utils/geometry.js';
import { Input } from '../systems/input.js';
import { Store } from '../core/store.js';
import { SliceOp } from './slice-op.js';

export const ThreedOp = {
    handleMouseMove: (e) => {
        if (!STATE.ui.is3DOpen || STATE.ui.activeTool3D !== 'SLICE') {
            SliceOp.clearPreview(); // Ensure cleanup if we switched tools
            return;
        }

        const { renderer3D } = STATE;
        const rect = renderer3D.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, renderer3D.cameraPersp);
        const intersects = raycaster.intersectObjects(renderer3D.extrudedMeshes, true);
        
        SliceOp.handleMouseMove(e, raycaster, intersects);
    },

    handleMouseDown: (e) => {
        const { renderer3D } = STATE;
        if (!renderer3D || renderer3D.mode !== '3D') return;

        if (STATE.ui.activeTool3D === 'SLICE') {
            SliceOp.handleClick();
            return;
        }

        // 1. Setup Raycaster
        const rect = renderer3D.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, renderer3D.cameraPersp);

        // 2. Intersect Meshes
        const intersects = raycaster.intersectObjects(renderer3D.extrudedMeshes, true);

        if (intersects.length > 0) {
            // Find the top-level group/object that has our shapeId
            let obj = intersects[0].object;
            while (obj && !obj.userData.shapeId) {
                obj = obj.parent;
            }

            if (obj && obj.userData.shapeId) {
                let targetId = obj.userData.shapeId;

                // --- 3D CLONE LOGIC ---
                if (e.ctrlKey || e.metaKey) {
                    const originalShape = STATE.document.shapes.find(s => s.id === targetId);
                    if (originalShape) {
                        const newId = Math.random().toString(36).substr(2, 9);
                        const newShape = structuredClone(originalShape);
                        newShape.id = newId;
                        newShape.name = `${originalShape.name} (Copy)`;
                        newShape.lastModified = Date.now();
                        
                        // Slightly offset the clone so it's visible if not moved
                        if (newShape.transform3D) {
                            newShape.transform3D.position.x += 10;
                            newShape.transform3D.position.y += 10;
                        }
                        // ALSO offset 2D points so it reflects in 2D scene
                        newShape.points = newShape.points.map(p => ({ ...p, x: p.x + 10, y: p.y + 10 }));

                        Store.dispatch('SHAPE_ADD_3D', {
                            document: { shapes: [...STATE.document.shapes, newShape] },
                            ui: { selectedAssemblyId: newId, selectedShapeId: newId }
                        }, true);
                        
                        // We need to wait for the next render to attach to the NEW object
                        // but since we are in a synchronous event, we'll let the next
                        // click or the store update handle the attachment.
                        // For immediate feedback, we can't easily attach to a non-existent mesh.
                        return; 
                    }
                }

                // Attach the gizmo
                renderer3D.transformControls.attach(obj);
                
                // Track this as our selected assembly part AND selected shape for properties
                // Dispatch Selection
                Store.dispatch('SELECT_SHAPE_3D', {
                    ui: { 
                        selectedAssemblyId: obj.userData.shapeId,
                        selectedShapeId: obj.userData.shapeId
                    }
                });
            }
        } else {
            // Check if we clicked the Gizmo
            // We raycast against the transform controls to see if we are interacting with it
            const gizmoIntersects = raycaster.intersectObjects(renderer3D.transformControls.children, true);
            if (gizmoIntersects.length > 0) {
                return; // Let the gizmo handle it
            }

            // Clicked empty space
            renderer3D.transformControls.detach();
            Store.dispatch('DESELECT_3D', {
                ui: { 
                    selectedAssemblyId: null,
                    selectedShapeId: null
                }
            });
        }
    },

    handleKeyDown: (e) => {
        const { renderer3D } = STATE;
        if (!renderer3D || !renderer3D.transformControls) return;

        switch (e.key.toLowerCase()) {
            case 't':
                renderer3D.transformControls.setMode('translate');
                break;
            case 'r':
                renderer3D.transformControls.setMode('rotate');
                break;
            case 'escape':
                renderer3D.transformControls.detach();
                Store.dispatch('DESELECT_3D', {
                    ui: { 
                        selectedAssemblyId: null,
                        selectedShapeId: null
                    }
                });
                break;
        }
    },

    /**
     * Persists the current 3D transforms of the meshes back into the Document JSON.
     */
    persistTransforms: () => {
        const { renderer3D } = STATE;
        if (!renderer3D || !STATE.ui.is3DOpen) return;

        let hasChanges = false;
        // Map current shapes to new list with updated transforms
        const newShapes = STATE.document.shapes.map(shape => {
            // Find corresponding mesh group
            const group = renderer3D.extrudedMeshes.find(g => g.userData.shapeId === shape.id);
            
            if (group) {
                const centroid = Geometry.calculateBoundingCenter(shape.points);
                
                const newTransform = {
                    position: {
                        x: group.position.x - centroid.x,
                        y: group.position.y - centroid.y,
                        z: group.position.z
                    },
                    rotation: {
                        x: group.rotation.x,
                        y: group.rotation.y,
                        z: group.rotation.z
                    }
                };

                // Check for diff (simple equality check)
                // Actually, just updating is fine, Store merge handles it.
                // But to avoid infinite loops if this triggered a re-render which triggered a persist...
                // Wait, 'persistTransforms' is called on 'change' event from gizmo.
                
                // We create a new shape object
                hasChanges = true;
                return { ...shape, transform3D: newTransform };
            }
            return shape;
        });
        
        if (hasChanges) {
            Store.dispatch('SHAPE_TRANSFORM_3D', {
                document: { shapes: newShapes }
            });
        }
    }
};
