/**
 * @fileoverview Drawing Operations
 * Handles the logic for creating new shapes.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { ShapeModel } from '../core/model.js';
import { Store } from '../core/store.js';

export const DrawingOp = {
    /**
     * Handles clicks on the canvas during drawing mode.
     * Manages state transitions via Store Dispatch.
     */
    handleDrawClick: (mouseWorld, mouseScreen) => {
        const { ui } = STATE;
        const { activeDrawing } = ui;

        if (ui.drawState === 'IDLE') {
            Store.dispatch('DRAW_START', { 
                ui: { 
                    drawState: 'START_SHAPE',
                    activeDrawing: { ...ui.activeDrawing, points: [mouseWorld] }
                }
            }, true);
        } else if (ui.drawState === 'START_SHAPE') {
            if (activeDrawing.highlightedDirection) {
                Store.dispatch('DRAW_DIRECTION_SET', {
                    ui: {
                        drawState: 'DRAWING_LINE',
                        activeDrawing: { 
                            ...ui.activeDrawing, 
                            selectedDirection: activeDrawing.highlightedDirection,
                            highlightedDirection: null 
                        }
                    }
                }, true);
            } else {
                // Reset to IDLE then restart (recursive-ish behavior but via store)
                // Actually, just restart drawing at new point
                Store.dispatch('DRAW_RESET', {
                    ui: {
                        drawState: 'IDLE',
                        activeDrawing: { points: [mouseWorld], tempLine: null, alignmentGuide: null } // Immediately start new?
                    }
                }, true);
                // To match previous logic: effectively click again.
                // Simpler: Just dispatch DRAW_START with new point.
                Store.dispatch('DRAW_START', { 
                    ui: { 
                        drawState: 'START_SHAPE',
                        activeDrawing: { ...ui.activeDrawing, points: [mouseWorld] }
                    }
                }, true);
            }
        } else if (ui.drawState === 'DRAWING_LINE') {
            const activePt = activeDrawing.points[activeDrawing.points.length - 1];
            const target = activeDrawing.snapTarget || activeDrawing.tempLine.end;
            
            const dist = Geometry.dist(activePt, target);
            // We can't mutate activePt directly if we want Flux purity, but points are objects.
            // For now, let's assume points are mutable during drawing or we replace the array.
            // A cleaner way: Clone the points array.
            const newPoints = [...activeDrawing.points];
            newPoints[newPoints.length - 1].lengthToNext = dist / CONFIG.SCALE_PIXELS_PER_INCH;

            if (activeDrawing.snapTarget) {
                // Finalize Shape
                const name = `Part ${STATE.document.shapes.length + 1}`;
                const newShape = ShapeModel.create(newPoints, name);
                
                // Dispatch ADD_SHAPE
                // This will also need to handle the UI reset
                Store.dispatch('SHAPE_ADD', {
                    document: { shapes: [...STATE.document.shapes, newShape] },
                    ui: { 
                        drawState: 'IDLE',
                        activeDrawing: { points: [], tempLine: null, alignmentGuide: null, snapTarget: null },
                        selectedShapeId: newShape.id,
                        mode: 'SELECT' // Switch tool
                    }
                }, true); // Persist for Undo
                
                return newShape; 
            } else {
                // Add Point
                newPoints.push(target);
                Store.dispatch('DRAW_POINT_ADDED', {
                    ui: {
                        drawState: 'START_SHAPE',
                        activeDrawing: { 
                            ...ui.activeDrawing, 
                            points: newPoints,
                            tempLine: null,
                            alignmentGuide: null,
                            selectedDirection: null,
                            snapTarget: null
                        }
                    }
                }, true);
            }
        }
        return null;
    },

    /**
     * Updates the drawing preview (guides, snap lines, compass) on mouse move.
     * @param {Object} mouseWorld - Mouse position in world coordinates.
     * @param {Object} mouseScreen - Mouse position in screen coordinates.
     */
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
            
            // TEACHING MOMENT: Vector Projection
            // We want to lock the mouse movement to a specific line (the 'dir' vector).
            // To do this, we take the vector from the start point to the mouse...
            const vecToMouse = { x: mouseWorld.x - activePt.x, y: mouseWorld.y - activePt.y };
            
            // ...and calculate the Dot Product.
            // Think of this as casting a "Shadow" of the mouse vector onto our direction line.
            // 'len' becomes the distance along that line where the shadow falls.
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

    /**
     * Cancels the current drawing operation and resets state.
     */
    cancel: () => {
        Store.dispatch('DRAW_CANCEL', {
            ui: {
                drawState: 'IDLE',
                activeDrawing: { 
                    points: [], 
                    tempLine: null, 
                    alignmentGuide: null, 
                    selectedDirection: null, 
                    snapTarget: null, 
                    highlightedDirection: null 
                }
            }
        });
    }
};
