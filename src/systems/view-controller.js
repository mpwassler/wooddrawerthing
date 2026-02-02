/**
 * @fileoverview View Controller
 * Bridges Application State and Renderers.
 */

import { STATE } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Geometry } from '../utils/geometry.js';
import { DOM } from '../core/dom.js';

export const ViewController = {
    render: () => {
        const { renderer: r, overlay: o } = STATE;
        if (!r || !o) return;

        r.clear();
        o.clear();

        // 1. World Coordinate Layer (WebGL & Geometry)
        r.pushWorldTransform(STATE.ui.view.pan.x, STATE.ui.view.pan.y, STATE.ui.view.zoom);
        ViewController._drawWorldLayer(r);
        r.popTransform();

        // 2. World-Anchored Overlay Layer (Canvas - Dimensions/Joinery)
        o.pushWorldTransform(STATE.ui.view.pan.x, STATE.ui.view.pan.y, STATE.ui.view.zoom);
        ViewController._drawOverlayLayer(o);
        o.popTransform();

        // 3. Screen-Space UI Layer (Canvas - Drawing Tools)
        ViewController._drawScreenLayer(o);
    },

    /** Renders base geometry and grid */
    _drawWorldLayer: (r) => {
        const { view, activeDrawing, mode, drawState } = STATE.ui;
        
        // Grid
        const worldTL = Geometry.screenToWorld({x: 0, y: 0}, view);
        const worldBR = Geometry.screenToWorld({x: DOM.canvas.width, y: DOM.canvas.height}, view);
        r.drawGrid({left: worldTL.x, top: worldTL.y, right: worldBR.x, bottom: worldBR.y}, 20, CONFIG.COLORS.GRID, 1 / view.zoom);

        // All Shapes
        STATE.document.shapes.forEach(shape => {
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            const isHovered = shape.id === STATE.ui.hoveredShapeId;
            const activeFace = shape.activeFace || 'FRONT';

            if (activeFace === 'FRONT' || !isSelected) {
                ViewController._drawShapeStandard(r, shape, isSelected, isHovered, view.zoom);
            } else if (activeFace === 'BACK') {
                ViewController._drawShapeMirrored(r, shape, view.zoom);
            } else if (activeFace.startsWith('EDGE_')) {
                ViewController._drawShapeEdge(r, shape, activeFace, view.zoom);
            }
        });

        // Drawing Previews
        if (mode === 'DRAW' && activeDrawing.points.length > 0) {
            const pts = activeDrawing.points;
            for (let i = 0; i < pts.length - 1; i++) r.drawLine(pts[i], pts[i+1], CONFIG.COLORS.GUIDE_LINE, 2 / view.zoom);
            if (drawState === 'DRAWING_LINE' && activeDrawing.tempLine) {
                r.drawLine(activeDrawing.tempLine.start, activeDrawing.tempLine.end, CONFIG.COLORS.GUIDE_LINE, 2 / view.zoom, [6, 4]);
            }
        }

        if (activeDrawing.alignmentGuide) {
            r.drawLine(activeDrawing.alignmentGuide.start, activeDrawing.alignmentGuide.end, CONFIG.COLORS.ALIGNMENT_GUIDE, 1 / view.zoom, [4, 4]);
        }
    },

    /** Renders dimensions, joinery, and markers */
    _drawOverlayLayer: (o) => {
        STATE.document.shapes.forEach(shape => {
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            const activeFace = shape.activeFace || 'FRONT';
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;

            // Dimensions
            ViewController._drawDimensions(o, shape, isSelected, activeFace);

            // Joinery (Tenons/Mortises)
            const faceData = (shape.faceData && shape.faceData[activeFace]) ? shape.faceData[activeFace] : { tenons: [], cutouts: [] };
            const origin = ViewController._getFaceOrigin(shape, activeFace, isSelected, scale);
            const xMult = (isSelected && activeFace === 'BACK') ? -1 : 1;

            const drawBox = (item, color, fillColor) => {
                if (!isSelected && activeFace !== 'FRONT') return;
                const worldX = origin.x + (item.x * scale * xMult) - (xMult === -1 ? item.w * scale : 0);
                const worldY = origin.y + item.y * scale;
                const w = item.w * scale, h = item.h * scale;
                const pts = [{x:worldX, y:worldY}, {x:worldX+w, y:worldY}, {x:worldX+w, y:worldY+h}, {x:worldX, y:worldY+h}];
                
                if (fillColor) o.drawPolygon(pts, fillColor);
                const closed = [...pts, pts[0]];
                for(let k=0; k<4; k++) o.drawLine(closed[k], closed[k+1], color, 2 / STATE.ui.view.zoom);

                if (isSelected) {
                    const fs = 10 / STATE.ui.view.zoom;
                    o.drawTextOutlined(Geometry.formatInches(item.w), { x: worldX + w/2, y: worldY - 5/STATE.ui.view.zoom }, fs, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
                    o.drawTextOutlined(Geometry.formatInches(item.h), { x: worldX - 5/STATE.ui.view.zoom, y: worldY + h/2 }, fs, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
                }
            };

            if (faceData.cutouts) faceData.cutouts.forEach(c => drawBox(c, '#d9534f', 'rgba(217, 83, 79, 0.1)'));
            if (faceData.tenons) faceData.tenons.forEach(t => drawBox(t, '#2e7d32', CONFIG.COLORS.SHAPE_FILL));
            
            // Center Marker
            if (activeFace === 'FRONT' && shape.closed) {
                const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
                const cy = shape.points.reduce((a, b) => a + b.y, 0) / shape.points.length;
                const sc = Geometry.worldToScreen({x: cx, y: cy}, STATE.ui.view); // Screen space crosshair
                // Note: Markers are drawn in screen space usually, but we draw them here for centroid relative logic. 
                // Let's actually draw them in the screen layer for better clarity.
            }
        });
    },

    /** Renders UI elements that don't scale with zoom */
    _drawScreenLayer: (o) => {
        const { view, activeDrawing, mode, drawState } = STATE.ui;
        if (mode !== 'DRAW') return;

        const activePt = activeDrawing.points.length > 0 ? activeDrawing.points[activeDrawing.points.length - 1] : null;
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
    },

    // --- Internal Geometry Helpers ---

    _drawShapeStandard: (r, shape, isSelected, isHovered, zoom) => {
        const color = isSelected ? CONFIG.COLORS.SHAPE_SELECTED : (isHovered ? CONFIG.COLORS.SHAPE_HOVER : CONFIG.COLORS.SHAPE_DEFAULT);
        const lineWidth = (isSelected || isHovered ? 3 : 2) / zoom;
        if (shape.closed && shape.points.length > 2) r.drawPolygon(shape.points, isSelected ? CONFIG.COLORS.SHAPE_FILL_SELECTED : CONFIG.COLORS.SHAPE_FILL);
        for (let i = 0; i < shape.points.length; i++) {
            const p1 = shape.points[i], p2 = shape.points[(i + 1) % shape.points.length];
            if (!shape.closed && i === shape.points.length - 1) continue;
            r.drawLine(p1, p2, color, lineWidth);
        }
    },

    _drawShapeMirrored: (r, shape, zoom) => {
        const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
        const mirrored = shape.points.map(p => ({ x: 2 * cx - p.x, y: p.y }));
        r.drawPolygon(mirrored, CONFIG.COLORS.SHAPE_FILL_SELECTED);
        for (let i = 0; i < mirrored.length; i++) r.drawLine(mirrored[i], mirrored[(i+1)%mirrored.length], CONFIG.COLORS.SHAPE_SELECTED, 3/zoom);
    },

    _drawShapeEdge: (r, shape, activeFace, zoom) => {
        const edgeIdx = parseInt(activeFace.split('_')[1]);
        const edgeLen = shape.points[edgeIdx].lengthToNext || 0;
        const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
        const scale = CONFIG.SCALE_PIXELS_PER_INCH;
        const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
        const cy = shape.points.reduce((a, b) => a + b.y, 0) / shape.points.length;
        const hw = (edgeLen * scale) / 2, hh = (thickness * scale) / 2;
        const pts = [{x:cx-hw, y:cy-hh}, {x:cx+hw, y:cy-hh}, {x:cx+hw, y:cy+hh}, {x:cx-hw, y:cy+hh}];
        r.drawPolygon(pts, CONFIG.COLORS.SHAPE_FILL);
        for(let k=0; k<4; k++) r.drawLine(pts[k], pts[(k+1)%4], CONFIG.COLORS.SHAPE_SELECTED, 3/zoom);
    },

    _drawDimensions: (o, shape, isSelected, activeFace) => {
        if (activeFace === 'FRONT' || !isSelected) {
            shape.points.forEach((p, i) => {
                const next = shape.points[(i + 1) % shape.points.length];
                if (shape.closed || i < shape.points.length - 1) ViewController.drawDimension(p, next, p.lengthToNext);
            });
        } else if (activeFace === 'BACK') {
            const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
            shape.points.forEach((p, i) => {
                const next = shape.points[(i + 1) % shape.points.length];
                if (shape.closed || i < shape.points.length - 1) {
                    ViewController.drawDimension({x: 2*cx-p.x, y:p.y}, {x: 2*cx-next.x, y:next.y}, p.lengthToNext);
                }
            });
        } else if (activeFace.startsWith('EDGE_')) {
            const idx = parseInt(activeFace.split('_')[1]);
            const len = shape.points[idx].lengthToNext || 0;
            const thick = shape.thickness || CONFIG.DEFAULT_THICKNESS;
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
            const cy = shape.points.reduce((a, b) => a + b.y, 0) / shape.points.length;
            const hw = (len * scale) / 2, hh = (thick * scale) / 2;
            ViewController.drawDimension({x:cx-hw, y:cy-hh}, {x:cx+hw, y:cy-hh}, len);
            ViewController.drawDimension({x:cx-hw, y:cy+hh}, {x:cx-hw, y:cy-hh}, thick);
        }
    },

    _getFaceOrigin: (shape, activeFace, isSelected, scale) => {
        const cx = shape.points.reduce((a, b) => a + b.x, 0) / shape.points.length;
        const cy = shape.points.reduce((a, b) => a + b.y, 0) / shape.points.length;
        if (isSelected && activeFace === 'BACK') return { x: 2 * cx - shape.points[0].x, y: shape.points[0].y };
        if (isSelected && activeFace.startsWith('EDGE_')) {
            const idx = parseInt(activeFace.split('_')[1]);
            const len = shape.points[idx].lengthToNext || 0;
            const thick = shape.thickness || CONFIG.DEFAULT_THICKNESS;
            return { x: cx - (len * scale) / 2, y: cy - (thick * scale) / 2 };
        }
        return shape.points[0];
    },

    drawDimension: (start, end, lengthInches) => {
        if (!lengthInches) return;
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const vec = { x: end.x - start.x, y: end.y - start.y };
        const norm = Geometry.normalize(vec);
        const perp = { x: -norm.y, y: norm.x };
        if (perp.y > 0) { perp.x *= -1; perp.y *= -1; }
        const labelPos = { x: mid.x + perp.x * (12 / STATE.ui.view.zoom), y: mid.y + perp.y * (12 / STATE.ui.view.zoom) };
        STATE.overlay.drawTextOutlined(Geometry.formatInches(lengthInches), labelPos, 12 / STATE.ui.view.zoom, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
    },

    drawCompass: (screenPos) => {
        const r1 = CONFIG.ARROW_GRID_RADIUS;
        const r2 = r1 * 1.8;
        
        const directions = [
            // Inner Ring
            { vec: {x:0,y:-1}, label: '90°', r:r1 }, 
            { vec: {x:1,y:-1}, label: '45°', r:r1 },
            { vec: {x:1,y:0}, label: '0°', r:r1 },  
            { vec: {x:1,y:1}, label: '315°', r:r1 },
            { vec: {x:0,y:1}, label: '270°', r:r1 },  
            { vec: {x:-1,y:1}, label: '225°', r:r1 },
            { vec: {x:-1,y:0}, label: '180°', r:r1 }, 
            { vec: {x:-1,y:-1}, label: '135°', r:r1 },
            // Outer Ring (Approx vectors for 22.5 steps)
            { vec: {x:0.38,y:-0.92}, label: '67.5°', r:r2 },
            { vec: {x:0.92,y:-0.38}, label: '22.5°', r:r2 },
            { vec: {x:0.92,y:0.38}, label: '337.5°', r:r2 },
            { vec: {x:0.38,y:0.92}, label: '292.5°', r:r2 },
            { vec: {x:-0.38,y:0.92}, label: '247.5°', r:r2 },
            { vec: {x:-0.92,y:0.38}, label: '202.5°', r:r2 },
            { vec: {x:-0.92,y:-0.38}, label: '157.5°', r:r2 },
            { vec: {x:-0.38,y:-0.92}, label: '112.5°', r:r2 }
        ];

        directions.forEach(dir => {
            const norm = Geometry.normalize(dir.vec);
            const radius = dir.r;
            const pos = { x: screenPos.x + norm.x * radius, y: screenPos.y + norm.y * radius };
            
            // Check highlight match loosely on direction
            const h = STATE.ui.activeDrawing.highlightedDirection;
            // Epsilon match for floats
            const matchX = h && Math.abs(h.x - dir.vec.x) < 0.01;
            const matchY = h && Math.abs(h.y - dir.vec.y) < 0.01;
            // Also ensure radius matches to differentiate inner/outer overlaps
            const matchR = h && Math.abs(h.r - radius) < 1;

            if (matchX && matchY && matchR) {
                // Draw connecting line
                STATE.overlay.drawLine(screenPos, pos, CONFIG.COLORS.SHAPE_SELECTED, 2);
                // Draw circle (slightly larger when highlighted)
                const hRadius = (radius === r2 ? CONFIG.ARROW_SIZE / 3 : CONFIG.ARROW_SIZE / 2) * 1.4;
                STATE.overlay.drawCircle(pos, hRadius, CONFIG.COLORS.SHAPE_SELECTED);
                // Draw Label
                const labelPos = { x: pos.x + norm.x * 20, y: pos.y + norm.y * 20 };
                STATE.overlay.drawTextOutlined(dir.label, labelPos, 12, CONFIG.COLORS.TEXT, CONFIG.COLORS.TEXT_BG);
            } else {
                // Outer ring circles are smaller
                const dotRadius = radius === r2 ? CONFIG.ARROW_SIZE / 3 : CONFIG.ARROW_SIZE / 2;
                STATE.overlay.drawCircle(pos, dotRadius, CONFIG.COLORS.SHAPE_HOVER);
            }
        });
    }
};