/**
 * @fileoverview Drawing Operations
 * Handles the logic for creating new shapes.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';

export const DrawingOp = {
    handleDrawClick: (mouseWorld, mouseScreen) => {
        const { ui } = STATE;
        const { activeDrawing } = ui;

        if (ui.drawState === 'IDLE') {
            activeDrawing.points = [mouseWorld];
            ui.drawState = 'START_SHAPE';
        } else if (ui.drawState === 'START_SHAPE') {
            if (activeDrawing.highlightedDirection) {
                activeDrawing.selectedDirection = activeDrawing.highlightedDirection;
                ui.drawState = 'DRAWING_LINE';
                activeDrawing.highlightedDirection = null;
            } else {
                ui.drawState = 'IDLE';
                return DrawingOp.handleDrawClick(mouseWorld, mouseScreen); 
            }
        } else if (ui.drawState === 'DRAWING_LINE') {
            const activePt = activeDrawing.points[activeDrawing.points.length - 1];
            const target = activeDrawing.snapTarget || activeDrawing.tempLine.end;
            
            const dist = Geometry.dist(activePt, target);
            activePt.lengthToNext = dist / CONFIG.SCALE_PIXELS_PER_INCH;

            if (activeDrawing.snapTarget) {
                // Finalize Shape
                const newId = Math.random().toString(36).substr(2, 9);
                const newShape = {
                    id: newId,
                    name: `Part ${STATE.document.shapes.length + 1}`,
                    points: [...activeDrawing.points],
                    closed: true,
                    thickness: CONFIG.DEFAULT_THICKNESS,
                    activeFace: 'FRONT',
                    faceData: {
                        'FRONT': { tenons: [], cutouts: [] },
                        'BACK': { tenons: [], cutouts: [] }
                    },
                    transform3D: {
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 }
                    }
                };
                
                // Initialize Edge data
                newShape.points.forEach((p, i) => {
                    newShape.faceData[`EDGE_${i}`] = { tenons: [], cutouts: [] };
                });
                
                Geometry.recalculateSideLengths(newShape.points, CONFIG.SCALE_PIXELS_PER_INCH);
                STATE.document.shapes.push(newShape);
                
                // Cleanup drawing state
                activeDrawing.points = [];
                activeDrawing.tempLine = null;
                activeDrawing.alignmentGuide = null;
                activeDrawing.selectedDirection = null;
                activeDrawing.snapTarget = null;
                ui.drawState = 'IDLE';
                
                return newShape; 
            } else {
                activeDrawing.points.push(target);
                ui.drawState = 'START_SHAPE';
            }
            
            activeDrawing.tempLine = null;
            activeDrawing.alignmentGuide = null;
            activeDrawing.selectedDirection = null;
            activeDrawing.snapTarget = null;
        }
        return null;
    },

    updatePreview: (mouseWorld, mouseScreen) => {
        const { ui } = STATE;
        const { activeDrawing, view } = ui;
        const pts = activeDrawing.points;
        if (pts.length === 0) return;

        const activePt = pts[pts.length - 1];

        if (ui.drawState === 'START_SHAPE') {
            const screenActive = Geometry.worldToScreen(activePt, view);
            const r1 = CONFIG.ARROW_GRID_RADIUS;
            const r2 = r1 * 1.8;

            const arrows = [
                // Inner Ring (45 deg increments)
                {x:0,y:-1}, {x:1,y:-1}, {x:1,y:0}, {x:1,y:1}, {x:0,y:1}, {x:-1,y:1}, {x:-1,y:0}, {x:-1,y:-1},
                // Outer Ring (22.5 deg increments - approximated)
                {x:0.38,y:-0.92, r:r2}, {x:0.92,y:-0.38, r:r2}, 
                {x:0.92,y:0.38, r:r2}, {x:0.38,y:0.92, r:r2},
                {x:-0.38,y:0.92, r:r2}, {x:-0.92,y:0.38, r:r2},
                {x:-0.92,y:-0.38, r:r2}, {x:-0.38,y:-0.92, r:r2}
            ];
            
            let closest = null;
            let minDist = Infinity;
            arrows.forEach(vec => {
                const radius = vec.r || r1;
                // normalize direction but keep aspect
                const norm = Geometry.normalize(vec); 
                const arrowPos = {
                    x: screenActive.x + norm.x * radius,
                    y: screenActive.y + norm.y * radius
                };
                const d = Geometry.dist(mouseScreen, arrowPos);
                if (d < minDist) { 
                    minDist = d; 
                    // Store strict normalized vec for logic, but maybe tag it?
                    // We just need the direction vector for the line
                    closest = { x: vec.x, y: vec.y, r: radius }; 
                }
            });
            // Only snap if within reasonable distance of a point
            if (minDist < 60) {
                activeDrawing.highlightedDirection = closest;
            } else {
                activeDrawing.highlightedDirection = null;
            }

        } else if (ui.drawState === 'DRAWING_LINE') {
            const dir = Geometry.normalize(activeDrawing.selectedDirection);
            const vecToMouse = { x: mouseWorld.x - activePt.x, y: mouseWorld.y - activePt.y };
            let len = Math.max(0, Geometry.dot(vecToMouse, dir));
            
            // --- Adaptive Multi-Tiered Snapping ---
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const pixelScale = scale * view.zoom; // Pixels per inch on screen
            const snapPx = CONFIG.SNAP_RADIUS_SCREEN_PX;
            const lenInches = len / scale;

            // Define snap tiers: [increment, priority/radius weight]
            const tiers = [
                { inc: 1.0,   weight: 1.0 }, // Whole Inch
                { inc: 0.5,   weight: 0.8 }, // Half Inch
                { inc: 0.25,  weight: 0.6 }, // Quarter Inch
                { inc: 0.125, weight: 0.4 }  // Eighth Inch
            ];

            for (const tier of tiers) {
                const nearest = Math.round(lenInches / tier.inc) * tier.inc;
                const distInInches = Math.abs(lenInches - nearest);
                const distInPixels = distInInches * pixelScale;
                
                // Adaptive Threshold:
                // We want the snap to be "sticky" but never more than 40% of the way to the next mark
                const maxAllowedRadius = (tier.inc * pixelScale) * 0.4;
                const threshold = Math.min(snapPx * tier.weight, maxAllowedRadius);

                if (distInPixels < threshold) {
                    len = nearest * scale;
                    break; // Snap to the largest matching increment
                }
            }
            // ---------------------------------------------

            activeDrawing.snapTarget = null;
            activeDrawing.alignmentGuide = null;
            
            const startPt = pts[0];
            const startScreen = Geometry.worldToScreen(startPt, view);
            if (pts.length > 2) {
                if (Geometry.dist(mouseScreen, startScreen) < CONFIG.SNAP_RADIUS_SCREEN_PX) {
                    activeDrawing.snapTarget = startPt;
                    activeDrawing.tempLine = { start: activePt, end: startPt };
                    return; 
                }
            }

            if (dir.x !== 0) { 
                const t = (startPt.x - activePt.x) / dir.x;
                if (t > 0 && Math.abs((t - len) * view.zoom) < CONFIG.SNAP_RADIUS_SCREEN_PX) {
                    len = t;
                    const alignPt = { x: activePt.x + dir.x * len, y: activePt.y + dir.y * len };
                    activeDrawing.alignmentGuide = { start: startPt, end: alignPt };
                }
            }
            if (dir.y !== 0) { 
                 const t = (startPt.y - activePt.y) / dir.y;
                if (t > 0 && Math.abs((t - len) * view.zoom) < CONFIG.SNAP_RADIUS_SCREEN_PX) {
                    len = t;
                    const alignPt = { x: activePt.x + dir.x * len, y: activePt.y + dir.y * len };
                    activeDrawing.alignmentGuide = { start: startPt, end: alignPt };
                }
            }

            const endPt = { x: activePt.x + dir.x * len, y: activePt.y + dir.y * len };
            activeDrawing.tempLine = { start: activePt, end: endPt };
        }
    },

    cancel: () => {
        const { ui } = STATE;
        ui.drawState = 'IDLE';
        ui.activeDrawing.points = [];
        ui.activeDrawing.tempLine = null;
        ui.activeDrawing.alignmentGuide = null;
        ui.activeDrawing.selectedDirection = null;
        ui.activeDrawing.snapTarget = null;
        ui.activeDrawing.highlightedDirection = null;
    }
};