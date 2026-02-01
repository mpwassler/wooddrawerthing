/**
 * @fileoverview View Controller
 * Bridges Application State and Renderers.
 * Decides what to draw based on current mode and state.
 */

import { STATE } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Geometry } from '../utils/geometry.js';
import { DOM } from '../core/dom.js';

export const ViewController = {
    render: () => {
        const r = STATE.renderer; 
        const o = STATE.overlay;  
        if (!r || !o) return;

        const { view, activeDrawing, mode, drawState } = STATE.ui;

        r.clear();
        o.clear();

        // --- World Layer (WebGL) ---
        r.pushWorldTransform(view.pan.x, view.pan.y, view.zoom);
        
        // 1. Grid
        const gridSize = 20;
        const scaleGrid = gridSize * Math.pow(2, Math.floor(Math.log2(1/view.zoom)));
        const worldTL = Geometry.screenToWorld({x: 0, y: 0}, view);
        const worldBR = Geometry.screenToWorld({x: DOM.canvas.width, y: DOM.canvas.height}, view);
        r.drawGrid({left: worldTL.x, top: worldTL.y, right: worldBR.x, bottom: worldBR.y}, scaleGrid, CONFIG.COLORS.GRID, 1 / view.zoom);

        // 2. Shapes (Geometry)
        STATE.document.shapes.forEach(shape => {
            const isHovered = shape.id === STATE.ui.hoveredShapeId;
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            const color = isSelected ? CONFIG.COLORS.SHAPE_SELECTED : (isHovered ? CONFIG.COLORS.SHAPE_HOVER : CONFIG.COLORS.SHAPE_DEFAULT);
            const lineWidth = (isSelected || isHovered ? 3 : 2) / view.zoom;

            if (shape.closed && shape.points.length > 2) {
                r.drawPolygon(shape.points, isSelected ? CONFIG.COLORS.SHAPE_FILL_SELECTED : CONFIG.COLORS.SHAPE_FILL);
            }

            const drawSegment = (p1, p2) => r.drawLine(p1, p2, color, lineWidth);
            for (let i = 0; i < shape.points.length - 1; i++) {
                drawSegment(shape.points[i], shape.points[i+1]);
            }
            if (shape.closed && shape.points.length > 1) {
                drawSegment(shape.points[shape.points.length - 1], shape.points[0]);
            }
        });

        // 3. Drawing Preview (Existing segments of shape being drawn)
        if (mode === 'DRAW' && activeDrawing.points.length > 0) {
            const pts = activeDrawing.points;
            for (let i = 0; i < pts.length - 1; i++) {
                r.drawLine(pts[i], pts[i+1], CONFIG.COLORS.GUIDE_LINE, 2 / view.zoom);
            }
            // The segment currently being dragged
            if (drawState === 'DRAWING_LINE' && activeDrawing.tempLine) {
                r.drawLine(activeDrawing.tempLine.start, activeDrawing.tempLine.end, CONFIG.COLORS.GUIDE_LINE, 2 / view.zoom, [6, 4]);
            }
        }
        
        // 4. Alignment Guide
        if (activeDrawing.alignmentGuide) {
            r.drawLine(activeDrawing.alignmentGuide.start, activeDrawing.alignmentGuide.end, CONFIG.COLORS.ALIGNMENT_GUIDE, 1 / view.zoom, [4, 4]);
        }
        
        r.popTransform();

        // --- Overlay Layer (Canvas) ---
        o.pushWorldTransform(view.pan.x, view.pan.y, view.zoom);

        STATE.document.shapes.forEach(shape => {
            // Dimensions
            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[(i + 1) % shape.points.length];
                if (!shape.closed && i === shape.points.length - 1) continue;
                if (p1.lengthToNext) {
                    ViewController.drawDimension(p1, p2, p1.lengthToNext);
                }
            }

            // Joinery
            const startPt = shape.points[0];
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            
            const drawJoineryRect = (item, color, fillColor) => {
                const worldX = startPt.x + item.x * scale;
                const worldY = startPt.y + item.y * scale;
                const w = item.w * scale;
                const h = item.h * scale;
                const pts = [{x:worldX, y:worldY}, {x:worldX+w, y:worldY}, {x:worldX+w, y:worldY+h}, {x:worldX, y:worldY+h}];
                
                if (fillColor) o.drawPolygon(pts, fillColor);
                const closedPts = [...pts, pts[0]];
                for(let k=0; k<4; k++) o.drawLine(closedPts[k], closedPts[k+1], color, 2 / view.zoom);

                if (isSelected) {
                    const fontSize = 10 / view.zoom;
                    o.drawTextOutlined(Geometry.formatInches(item.w), { x: worldX + w/2, y: worldY - 5/view.zoom }, fontSize, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
                    o.drawTextOutlined(Geometry.formatInches(item.h), { x: worldX - 5/view.zoom, y: worldY + h/2 }, fontSize, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
                }
            };

            (shape.cutouts || []).forEach(c => drawJoineryRect(c, '#d9534f', 'rgba(217, 83, 79, 0.1)'));
            (shape.tenons || []).forEach(t => drawJoineryRect(t, '#2e7d32', CONFIG.COLORS.SHAPE_FILL));
            
            // Centroid
            if (shape.closed && shape.points.length > 0) {
                let cx = 0, cy = 0;
                shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length; cy /= shape.points.length;
                const screenC = Geometry.worldToScreen({x: cx, y: cy}, view);
                const size = 6;
                o.drawLine({x: screenC.x - size, y: screenC.y}, {x: screenC.x + size, y: screenC.y}, CONFIG.COLORS.ALIGNMENT_GUIDE, 1);
                o.drawLine({x: screenC.x, y: screenC.y - size}, {x: screenC.x, y: screenC.y + size}, CONFIG.COLORS.ALIGNMENT_GUIDE, 1);
            }
        });

        o.popTransform();

        // --- Screen Space Overlay ---
        if (mode === 'DRAW') {
            const activePt = activeDrawing.points.length > 0 ? activeDrawing.points[activeDrawing.points.length-1] : null;
            if (activePt) {
                const screen = Geometry.worldToScreen(activePt, view);
                o.drawCircle(screen, 5, CONFIG.COLORS.GUIDE_LINE);
                if (drawState === 'START_SHAPE') ViewController.drawCompass(screen);
            }
            if (activeDrawing.snapTarget) {
                o.drawCircle(Geometry.worldToScreen(activeDrawing.snapTarget, view), CONFIG.SNAP_RADIUS_SCREEN_PX / 2, CONFIG.COLORS.SNAP_POINT);
            }
            if (drawState === 'DRAWING_LINE' && activeDrawing.tempLine) {
                const dist = Geometry.dist(activeDrawing.tempLine.start, activeDrawing.tempLine.end);
                const screenEnd = Geometry.worldToScreen(activeDrawing.tempLine.end, view);
                o.drawText(Geometry.formatInches(dist / CONFIG.SCALE_PIXELS_PER_INCH), {x: screenEnd.x + 15, y: screenEnd.y - 15}, CONFIG.COLORS.TEXT, 14, 'left');
            }
        }
    },

    drawDimension: (start, end, lengthInches) => {
        const { view } = STATE.ui;
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const vec = { x: end.x - start.x, y: end.y - start.y };
        const norm = Geometry.normalize(vec);
        const perp = { x: -norm.y, y: norm.x };
        if (perp.y > 0) { perp.x *= -1; perp.y *= -1; }
        const labelPos = { x: mid.x + perp.x * (12 / view.zoom), y: mid.y + perp.y * (12 / view.zoom) };
        STATE.overlay.drawTextOutlined(Geometry.formatInches(lengthInches), labelPos, 12 / view.zoom, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
    },

    drawCompass: (screenPos) => {
        const directions = [{x:0,y:-1}, {x:1,y:-1}, {x:1,y:0}, {x:1,y:1}, {x:0,y:1}, {x:-1,y:1}, {x:-1,y:0}, {x:-1,y:-1}];
        directions.forEach(vec => {
            const norm = Geometry.normalize(vec);
            const pos = { x: screenPos.x + norm.x * CONFIG.ARROW_GRID_RADIUS, y: screenPos.y + norm.y * CONFIG.ARROW_GRID_RADIUS };
            const isHighlighted = STATE.ui.activeDrawing.highlightedDirection && STATE.ui.activeDrawing.highlightedDirection.x === vec.x && STATE.ui.activeDrawing.highlightedDirection.y === vec.y;
            let r = CONFIG.ARROW_SIZE / 2;
            let c = isHighlighted ? CONFIG.COLORS.SHAPE_SELECTED : CONFIG.COLORS.SHAPE_HOVER;
            if (isHighlighted) r *= 1.4;
            STATE.overlay.drawCircle(pos, r, c);
        });
    }
};
