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

        const { view, activeDrawing, mode, drawState, activeFace } = STATE.ui;

        r.clear();
        o.clear();

        // --- World Layer (WebGL) ---
        r.pushWorldTransform(view.pan.x, view.pan.y, view.zoom);
        
        // 1. Grid
        const worldTL = Geometry.screenToWorld({x: 0, y: 0}, view);
        const worldBR = Geometry.screenToWorld({x: DOM.canvas.width, y: DOM.canvas.height}, view);
        r.drawGrid({left: worldTL.x, top: worldTL.y, right: worldBR.x, bottom: worldBR.y}, 20, CONFIG.COLORS.GRID, 1 / view.zoom);

        // 2. Shapes (Geometry)
        STATE.document.shapes.forEach(shape => {
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            const isHovered = shape.id === STATE.ui.hoveredShapeId;
            const activeFace = shape.activeFace || 'FRONT';

            // Standard View (Non-selected shapes or FRONT face)
            if (activeFace === 'FRONT' || !isSelected) {
                const color = isSelected ? CONFIG.COLORS.SHAPE_SELECTED : (isHovered ? CONFIG.COLORS.SHAPE_HOVER : CONFIG.COLORS.SHAPE_DEFAULT);
                const lineWidth = (isSelected || isHovered ? 3 : 2) / view.zoom;

                if (shape.closed && shape.points.length > 2) {
                    r.drawPolygon(shape.points, isSelected ? CONFIG.COLORS.SHAPE_FILL_SELECTED : CONFIG.COLORS.SHAPE_FILL);
                }

                for (let i = 0; i < shape.points.length; i++) {
                    const p1 = shape.points[i];
                    const p2 = shape.points[(i + 1) % shape.points.length];
                    if (!shape.closed && i === shape.points.length - 1) continue;
                    r.drawLine(p1, p2, color, lineWidth);
                }
            } 
            // Back Face View (Horizontal Flip)
            else if (isSelected && activeFace === 'BACK') {
                let cx = 0; shape.points.forEach(p => cx += p.x); cx /= shape.points.length;
                const mirroredPoints = shape.points.map(p => ({ x: 2 * cx - p.x, y: p.y }));

                r.drawPolygon(mirroredPoints, CONFIG.COLORS.SHAPE_FILL_SELECTED);
                for (let i = 0; i < mirroredPoints.length; i++) {
                    const p1 = mirroredPoints[i], p2 = mirroredPoints[(i + 1) % mirroredPoints.length];
                    r.drawLine(p1, p2, CONFIG.COLORS.SHAPE_SELECTED, 3 / view.zoom);
                }
            }
            // Edge Isolation View
            else if (isSelected && activeFace.startsWith('EDGE_')) {
                const edgeIdx = parseInt(activeFace.split('_')[1]);
                const p1 = shape.points[edgeIdx];
                const edgeLen = p1.lengthToNext || 0;
                const thickness = shape.thickness || 0.75;
                const scale = CONFIG.SCALE_PIXELS_PER_INCH;

                // Center the edge rectangle on the shape's centroid
                let cx = 0, cy = 0;
                shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length; cy /= shape.points.length;

                const halfW = (edgeLen * scale) / 2;
                const halfH = (thickness * scale) / 2;

                const edgePoints = [
                    { x: cx - halfW, y: cy - halfH },
                    { x: cx + halfW, y: cy - halfH },
                    { x: cx + halfW, y: cy + halfH },
                    { x: cx - halfW, y: cy + halfH }
                ];

                r.drawPolygon(edgePoints, CONFIG.COLORS.SHAPE_FILL);
                for(let k=0; k<4; k++) r.drawLine(edgePoints[k], edgePoints[(k+1)%4], CONFIG.COLORS.SHAPE_SELECTED, 3/view.zoom);
            }
        });

        // 3. Drawing Preview
        if (mode === 'DRAW' && activeDrawing.points.length > 0) {
            const pts = activeDrawing.points;
            for (let i = 0; i < pts.length - 1; i++) r.drawLine(pts[i], pts[i+1], CONFIG.COLORS.GUIDE_LINE, 2/view.zoom);
            if (drawState === 'DRAWING_LINE' && activeDrawing.tempLine) r.drawLine(activeDrawing.tempLine.start, activeDrawing.tempLine.end, CONFIG.COLORS.GUIDE_LINE, 2/view.zoom, [6, 4]);
        }

        // 4. Alignment Guide
        if (activeDrawing.alignmentGuide) {
            r.drawLine(activeDrawing.alignmentGuide.start, activeDrawing.alignmentGuide.end, CONFIG.COLORS.ALIGNMENT_GUIDE, 1 / view.zoom, [4, 4]);
        }
        
        r.popTransform();

        // --- Overlay Layer (Canvas) ---
        o.pushWorldTransform(view.pan.x, view.pan.y, view.zoom);

        STATE.document.shapes.forEach(shape => {
            const isSelected = shape.id === STATE.ui.selectedShapeId;
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            // Dimensions Rendering
            if (activeFace && activeFace === 'FRONT' || !isSelected) {
                // Standard Front View Dimensions
                for (let i = 0; i < shape.points.length; i++) {
                    const p1 = shape.points[i];
                    const p2 = shape.points[(i + 1) % shape.points.length];
                    if (!shape.closed && i === shape.points.length - 1) continue;
                    if (p1.lengthToNext) ViewController.drawDimension(p1, p2, p1.lengthToNext);
                }
            } else if (isSelected && activeFace === 'BACK') {
                // Mirrored Back View Dimensions
                let cx = 0; shape.points.forEach(p => cx += p.x); cx /= shape.points.length;
                for (let i = 0; i < shape.points.length; i++) {
                    const p1 = shape.points[i], p2 = shape.points[(i + 1) % shape.points.length];
                    if (!shape.closed && i === shape.points.length - 1) continue;
                    if (p1.lengthToNext) {
                        const mp1 = { x: 2 * cx - p1.x, y: p1.y };
                        const mp2 = { x: 2 * cx - p2.x, y: p2.y };
                        ViewController.drawDimension(mp1, mp2, p1.lengthToNext);
                    }
                }
            } else if (isSelected && activeFace && activeFace.startsWith('EDGE_')) {
                // Edge Isolation View Dimensions
                const edgeIdx = parseInt(activeFace.split('_')[1]);
                const p1 = shape.points[edgeIdx];
                const edgeLen = p1.lengthToNext || 0;
                const thickness = shape.thickness || 0.75;
                const scale = CONFIG.SCALE_PIXELS_PER_INCH;

                let cx = 0, cy = 0; shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length; cy /= shape.points.length;

                const halfW = (edgeLen * scale) / 2;
                const halfH = (thickness * scale) / 2;

                // Width Dimension (Top)
                ViewController.drawDimension(
                    { x: cx - halfW, y: cy - halfH },
                    { x: cx + halfW, y: cy - halfH },
                    edgeLen
                );
                // Thickness Dimension (Left)
                ViewController.drawDimension(
                    { x: cx - halfW, y: cy + halfH },
                    { x: cx - halfW, y: cy - halfH },
                    thickness
                );
            }

            // Joinery Rendering
  
            const faceData = (shape.faceData && shape.faceData[activeFace]) ? shape.faceData[activeFace] : { tenons: [], cutouts: [] };
            
            let cx = 0, cy = 0;
            shape.points.forEach(p => { cx += p.x; cy += p.y; });
            cx /= shape.points.length; cy /= shape.points.length;

            let origin = shape.points[0];
            let xMultiplier = 1;

            if (isSelected && activeFace === 'BACK') {
                origin = { x: 2 * cx - shape.points[0].x, y: shape.points[0].y };
                xMultiplier = -1;
            } else if (isSelected && activeFace && activeFace.startsWith('EDGE_')) {
                const edgeIdx = parseInt(activeFace.split('_')[1]);
                const edgeLen = shape.points[edgeIdx].lengthToNext || 0;
                const thickness = shape.thickness || 0.75;
                origin = { x: cx - (edgeLen * scale) / 2, y: cy - (thickness * scale) / 2 };
            }

            const drawJoineryRect = (item, color, fillColor) => {
                // If we are looking at an edge, only draw joinery for the selected shape's active edge
                if (!isSelected && activeFace !== 'FRONT') return;

                const worldX = origin.x + (item.x * scale * xMultiplier) - (xMultiplier === -1 ? item.w * scale : 0);
                const worldY = origin.y + item.y * scale;
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

            if (faceData.cutouts) faceData.cutouts.forEach(c => drawJoineryRect(c, '#d9534f', 'rgba(217, 83, 79, 0.1)'));
            if (faceData.tenons) faceData.tenons.forEach(t => drawJoineryRect(t, '#2e7d32', CONFIG.COLORS.SHAPE_FILL));
            
            // Centroid (Front view only)
            if (activeFace === 'FRONT' && shape.closed && shape.points.length > 0) {
                let cx = 0, cy = 0;
                shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length; cy /= shape.points.length;
                const screenC = Geometry.worldToScreen({x: cx, y: cy}, view);
                o.drawLine({x: screenC.x - 6, y: screenC.y}, {x: screenC.x + 6, y: screenC.y}, CONFIG.COLORS.ALIGNMENT_GUIDE, 1);
                o.drawLine({x: screenC.x, y: screenC.y - 6}, {x: screenC.x, y: screenC.y + 6}, CONFIG.COLORS.ALIGNMENT_GUIDE, 1);
            }
        });

        o.popTransform();

        // --- Screen Space Overlay ---
        if (mode === 'DRAW') {
            const pts = activeDrawing.points;
            const activePt = pts.length > 0 ? pts[pts.length - 1] : null;
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