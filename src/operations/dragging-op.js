/**
 * @fileoverview Dragging Operations
 * Handles movement of shapes, joinery, and properties sliders.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';

export const DraggingOp = {
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
            
            let cx = 0, cy = 0;
            shape.points.forEach(p => { cx += p.x; cy += p.y; });
            cx /= shape.points.length; cy /= shape.points.length;

            let startPt = shape.points[0];
            let xMultiplier = 1;
            const pts = shape.points;

            if (activeFace === 'BACK') {
                startPt = { x: 2 * cx - shape.points[0].x, y: shape.points[0].y };
                xMultiplier = -1;
            } else if (activeFace.startsWith('EDGE_')) {
                const edgeIdx = parseInt(activeFace.split('_')[1]);
                const edgeLen = shape.points[edgeIdx].lengthToNext || 0;
                const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
                startPt = { 
                    x: cx - (edgeLen * scale) / 2, 
                    y: cy - (thickness * scale) / 2 
                };
            }
            
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
                        if (Math.abs(tCenterY - cy) < 50) {
                            newWorldY = cy - halfH;
                            ui.activeDrawing.alignmentGuide = { start: {x: cx - 20, y: cy}, end: {x: cx + 20, y: cy} };
                        }
                    } else {
                        newWorldY = Math.abs((newWorldY + item.h * scale) - bestSnap.closest.y) < Math.abs(newWorldY - bestSnap.closest.y) ? bestSnap.closest.y - item.h * scale : bestSnap.closest.y;
                        tCenterY = newWorldY + halfH;
                        if (Math.abs(tCenterX - cx) < 50) {
                            newWorldX = cx - halfW;
                            ui.activeDrawing.alignmentGuide = { start: {x: cx, y: cy - 20}, end: {x: cx, y: cy + 20} };
                        }
                    }
                }
            } else {
                // Cutout Snapping
                if (Math.abs(tCenterX - cx) < 30) { 
                    newWorldX = cx - halfW; 
                    ui.activeDrawing.alignmentGuide = { start: {x: cx, y: cy - 20}, end: {x: cx, y: cy + 20} }; 
                }
                if (Math.abs(tCenterY - cy) < 30) { 
                    newWorldY = cy - halfH; 
                    ui.activeDrawing.alignmentGuide = { start: {x: cx - 20, y: cy}, end: {x: cx + 20, y: cy} }; 
                }
            }

            if (activeFace === 'BACK') {
                // For BACK, item.x is measured from the right-side mirrored origin
                item.x = (startPt.x - (newWorldX + item.w * scale)) / scale;
            } else {
                item.x = (newWorldX - startPt.x) / scale;
            }
            item.y = (newWorldY - startPt.y) / scale;
        }

        else if (dragging.type === 'THICKNESS') {
            const dx = mouseScreen.x - dragging.startPos.x;
            const step = 1/16; 
            const steps = Math.round(dx / 10);
            let newVal = dragging.initialVal + (steps * step);
            dragging.item.thickness = Math.max(0.125, newVal);
            DOM.propThickness.value = Geometry.formatInches(dragging.item.thickness);
        }
    }
};
