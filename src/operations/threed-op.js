/**
 * @fileoverview 3D Assembly Operations
 * Handles clicking, dragging, and rotating objects in the 3D layout view.
 */

import { STATE } from '../core/state.js';
import * as THREE from 'https://esm.sh/three@0.160.0';
import { DocumentOp } from './document-op.js';

export const ThreedOp = {
    handleMouseDown: (e) => {
        const { renderer3D } = STATE;
        if (!renderer3D || renderer3D.mode !== '3D') return;

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
                // Attach the gizmo
                renderer3D.transformControls.attach(obj);
                
                // Track this as our selected assembly part
                STATE.ui.selectedAssemblyId = obj.userData.shapeId;
                
                // Prevent OrbitControls from interfering (handled by event listener in renderer)
            }
        } else {
            // Clicked empty space
            if (!renderer3D.transformControls.dragging) {
                renderer3D.transformControls.detach();
                STATE.ui.selectedAssemblyId = null;
            }
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
                STATE.ui.selectedAssemblyId = null;
                break;
        }
    },

    /**
     * Persists the current 3D transforms of the meshes back into the Document JSON.
     */
    persistTransforms: () => {
        const { renderer3D } = STATE;
        if (!renderer3D) return;

        renderer3D.extrudedMeshes.forEach(group => {
            const shapeId = group.userData.shapeId;
            const shape = STATE.document.shapes.find(s => s.id === shapeId);
            
            if (shape) {
                // We store the relative offset from its original 2D centroid
                // Original geometry is centered at its centroid
                // group.position contains [cx + tx, cy + ty, tz]
                
                // Let's just store the world position and rotation directly
                shape.transform3D = {
                    position: { x: group.position.x, y: group.position.y, z: group.position.z },
                    rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z }
                };
            }
        });
        
        DocumentOp.updateJSONExport();
    }
};
