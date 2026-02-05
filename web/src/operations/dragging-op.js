/**
 * @fileoverview Dragging Operations
 * Handles movement of shapes, joinery, and properties sliders via Store Dispatch.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';
import { Input } from '../systems/input.js';
import { Store } from '../core/store.js';

export const DraggingOp = {
    /**
     * Updates the position of the dragged item (shape, joinery, or thickness slider).
     * @param {Object} mouseWorld - Mouse position in world coordinates.
     * @param {Object} mouseScreen - Mouse position in screen coordinates.
     */
    update: (mouseWorld, mouseScreen) => {
        const { ui } = STATE;
        const { dragging } = ui;

        if (dragging.type === 'SHAPE') {
            const shape = dragging.item;
            const dx = mouseWorld.x - dragging.lastPos.x;
            const dy = mouseWorld.y - dragging.lastPos.y;
            
            if (dragging.isCloneMode) {
                // CLONE LOGIC
                const newId = Math.random().toString(36).substr(2, 9);
                const newShape = structuredClone(shape);
                newShape.id = newId;
                newShape.name = `${shape.name} (Copy)`;
                newShape.lastModified = Date.now();
                
                // Shift points by the initial delta
                newShape.points = newShape.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
                
                Store.dispatch('SHAPE_ADD', {
                    document: { shapes: [...STATE.document.shapes, newShape] },
                    ui: { 
                        selectedShapeId: newId,
                        dragging: { ...dragging, item: newShape, isCloneMode: false, lastPos: { ...mouseWorld } }
                    }
                }, true);
                return;
            }

            // REGULAR MOVE LOGIC
            // Clone points and update
            const newPoints = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy, lengthToNext: p.lengthToNext }));
            
            // Dispatch Update
            const newShape = { ...shape, points: newPoints, lastModified: Date.now() };
            const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
            
            Store.dispatch('SHAPE_DRAG_MOVE', { 
                document: { shapes: newShapes },
                ui: { dragging: { ...dragging, lastPos: { ...mouseWorld }, item: newShape } } // Update ref in dragging state
            });
        }

        else if (dragging.type === 'JOINERY') {
            const { item, shape, offset, listType } = dragging;
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const activeFace = shape.activeFace || 'FRONT';
            const { origin, xMult } = Geometry.getFaceOrigin(shape, activeFace, scale);
            const centroid = Geometry.calculateCentroid(shape.points);
            
            let newWorldX = mouseWorld.x - offset.x;
            let newWorldY = mouseWorld.y - offset.y;
            let alignmentGuide = null;

            const halfW = item.w * scale / 2;
            const halfH = item.h * scale / 2;
            let tCenterX = newWorldX + halfW;
            let tCenterY = newWorldY + halfH;

            // --- Snapping Logic ---
            if (listType === 'tenon') {
                let minDist = Infinity, bestSnap = null;
                const pts = shape.points;
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                    const closest = Geometry.closestPointOnSegment({x: tCenterX, y: tCenterY}, p1, p2);
                    const dist = Geometry.dist({x: tCenterX, y: tCenterY}, closest);
                    if (dist < minDist) { 
                        minDist = dist; 
                        bestSnap = { closest, isVert: Math.abs(p1.x - p2.x) < Math.abs(p1.y - p2.y), p1, p2 }; 
                    }
                }

                if (bestSnap && minDist < 50) {
                    if (bestSnap.isVert) {
                        newWorldX = Math.abs((newWorldX + item.w * scale) - bestSnap.closest.x) < Math.abs(newWorldX - bestSnap.closest.x) ? bestSnap.closest.x - item.w * scale : bestSnap.closest.x;
                        tCenterX = newWorldX + halfW;
                        if (Math.abs(tCenterY - centroid.y) < 50) {
                            newWorldY = centroid.y - halfH;
                            alignmentGuide = { start: {x: centroid.x - 20, y: centroid.y}, end: {x: centroid.x + 20, y: centroid.y} };
                        }
                    } else {
                        newWorldY = Math.abs((newWorldY + item.h * scale) - bestSnap.closest.y) < Math.abs(newWorldY - bestSnap.closest.y) ? bestSnap.closest.y - item.h * scale : bestSnap.closest.y;
                        tCenterY = newWorldY + halfH;
                        if (Math.abs(tCenterX - centroid.x) < 50) {
                            newWorldX = centroid.x - halfW;
                            alignmentGuide = { start: {x: centroid.x, y: centroid.y - 20}, end: {x: centroid.x, y: centroid.y + 20} };
                        }
                    }
                }
            } else {
                // Cutout Snapping
                if (Math.abs(tCenterX - centroid.x) < 30) { 
                    newWorldX = centroid.x - halfW; 
                    alignmentGuide = { start: {x: centroid.x, y: centroid.y - 20}, end: {x: centroid.x, y: centroid.y + 20} }; 
                }
                if (Math.abs(tCenterY - centroid.y) < 30) { 
                    newWorldY = centroid.y - halfH; 
                    alignmentGuide = { start: {x: centroid.x - 20, y: centroid.y}, end: {x: centroid.x + 20, y: centroid.y} }; 
                }
            }

            // Calculate new local Item coordinates
            let newItemX, newItemY;
            if (activeFace === 'BACK') {
                newItemX = (origin.x - (newWorldX + item.w * scale)) / scale;
            } else {
                newItemX = (newWorldX - origin.x) / scale;
            }
            newItemY = (newWorldY - origin.y) / scale;

            // Clone Shape and Item to Dispatch
            const newShape = structuredClone(shape);
            newShape.lastModified = Date.now(); // Update Timestamp
            const faceData = newShape.faceData[activeFace];
            // Find and update item in clone
            const targetList = listType === 'tenon' ? faceData.tenons : faceData.cutouts;
            
            // Identifying item by reference is hard after clone.
            // But we know 'item' is the same object reference as in the original state 
            // (dragging.item points to the live object in state when drag started).
            // Wait, if we dispatched PREVIOUSLY, dragging.item is updated to the NEW object?
            // Yes, "item: newShape" or "item: targetList[idx]".
            // But if we are looking in the OLD list from shape.faceData, we might fail if references changed.
            // Actually, we need to find the item in the NEW shape that corresponds to the OLD item.
            // Since we clone, we rely on index?
            // Or we just find the index in the OLD shape first.
            
            const oldFaceData = shape.faceData[activeFace];
            const oldList = listType === 'tenon' ? oldFaceData.tenons : oldFaceData.cutouts;
            const idx = oldList.indexOf(item);
            
            if (idx !== -1) {
                targetList[idx].x = newItemX;
                targetList[idx].y = newItemY;
                
                const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
                Store.dispatch('JOINERY_DRAG_MOVE', { 
                    document: { shapes: newShapes },
                    ui: { 
                        activeDrawing: { ...STATE.ui.activeDrawing, alignmentGuide },
                        dragging: { ...dragging, item: targetList[idx] } // Update reference to new item so next drag works
                    }
                });
            }
        }

        else if (dragging.type === 'THICKNESS') {
            const dx = mouseScreen.x - dragging.startPos.x;
            const step = 1/16; 
            const steps = Math.round(dx / 10);
            let newVal = dragging.initialVal + (steps * step);
            const newThickness = Math.max(0.125, newVal);
            
            const newShape = { ...dragging.item, thickness: newThickness, lastModified: Date.now() };
            const newShapes = STATE.document.shapes.map(s => s.id === newShape.id ? newShape : s);
            
            Store.dispatch('SHAPE_THICKNESS_DRAG', {
                document: { shapes: newShapes },
                ui: { dragging: { ...dragging, item: newShape } }
            });
        }
    }
};
