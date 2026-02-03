/**
 * @fileoverview Dragging Operations
 * Handles movement of shapes, joinery, and properties sliders.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';
import { Input } from '../systems/input.js';

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
            shape.points.forEach(p => { p.x += dx; p.y += dy; });
            dragging.lastPos = { ...mouseWorld };
        }

        else if (dragging.type === 'JOINERY') {
            const { item, shape, offset, listType } = dragging;
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const activeFace = shape.activeFace || 'FRONT';
            const { origin, xMult } = Geometry.getFaceOrigin(shape, activeFace, scale);
            const centroid = Geometry.calculateCentroid(shape.points);
            
            let newWorldX = mouseWorld.x - offset.x;
            let newWorldY = mouseWorld.y - offset.y;
            ui.activeDrawing.alignmentGuide = null;

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
                            ui.activeDrawing.alignmentGuide = { start: {x: centroid.x - 20, y: centroid.y}, end: {x: centroid.x + 20, y: centroid.y} };
                        }
                    } else {
                        newWorldY = Math.abs((newWorldY + item.h * scale) - bestSnap.closest.y) < Math.abs(newWorldY - bestSnap.closest.y) ? bestSnap.closest.y - item.h * scale : bestSnap.closest.y;
                        tCenterY = newWorldY + halfH;
                        if (Math.abs(tCenterX - centroid.x) < 50) {
                            newWorldX = centroid.x - halfW;
                            ui.activeDrawing.alignmentGuide = { start: {x: centroid.x, y: centroid.y - 20}, end: {x: centroid.x, y: centroid.y + 20} };
                        }
                    }
                }
            } else {
                // Cutout Snapping
                if (Math.abs(tCenterX - centroid.x) < 30) { 
                    newWorldX = centroid.x - halfW; 
                    ui.activeDrawing.alignmentGuide = { start: {x: centroid.x, y: centroid.y - 20}, end: {x: centroid.x, y: centroid.y + 20} }; 
                }
                if (Math.abs(tCenterY - centroid.y) < 30) { 
                    newWorldY = centroid.y - halfH; 
                    ui.activeDrawing.alignmentGuide = { start: {x: centroid.x - 20, y: centroid.y}, end: {x: centroid.x + 20, y: centroid.y} }; 
                }
            }

            // Persistence
            if (activeFace === 'BACK') {
                item.x = (origin.x - (newWorldX + item.w * scale)) / scale;
            } else {
                item.x = (newWorldX - origin.x) / scale;
            }
            item.y = (newWorldY - origin.y) / scale;
        }

        else if (dragging.type === 'THICKNESS') {
            const dx = mouseScreen.x - dragging.startPos.x;
            const step = 1/16; 
            const steps = Math.round(dx / 10);
            let newVal = dragging.initialVal + (steps * step);
            dragging.item.thickness = Math.max(0.125, newVal);
            DOM.propThickness.value = Geometry.formatInches(dragging.item.thickness);
            Input.refreshView();
        }
    }
};
