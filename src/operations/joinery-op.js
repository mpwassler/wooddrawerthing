/**
 * @fileoverview Joinery Operations
 * Logic for adding and managing tenons and cutouts.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { Input } from '../systems/input.js';

export const JoineryOp = {
    addTenon: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        
        // Use active face data
        const { tenons } = Input.activeFaceData();
        
        if (tenons.length > 0) {
            // Mirroring logic (Front face only for now, edges get basic stack)
            if (STATE.ui.activeFace === 'FRONT') {
                const target = JoineryOp.calculateMirrorPosition(shape, tenons);
                const pts = shape.points;
                let bestPt = null, minD = Infinity;
                
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                    const closest = Geometry.closestPointOnSegment(target, p1, p2);
                    const d = Geometry.dist(target, closest);
                    if (d < minD) { minD = d; bestPt = closest; }
                }
                
                if (bestPt) {
                    const scale = CONFIG.SCALE_PIXELS_PER_INCH;
                    const startPt = pts[0];
                    const last = tenons[tenons.length - 1];
                    tenons.push({
                        x: (bestPt.x - scale * last.w / 2 - startPt.x) / scale,
                        y: (bestPt.y - scale * last.h / 2 - startPt.y) / scale,
                        w: last.w, h: last.h, inset: last.inset || 0,
                        depth: shape.thickness || CONFIG.DEFAULT_THICKNESS
                    });
                }
            } else {
                // For edges, just add a new one offset
                const last = tenons[tenons.length - 1];
                tenons.push({ x: last.x + 2, y: 0, w: 2, h: 1, inset: 0, depth: shape.thickness || CONFIG.DEFAULT_THICKNESS });
            }
        } else {
            tenons.push({ x: 0, y: 0, w: 2, h: 1, inset: 0, depth: shape.thickness || CONFIG.DEFAULT_THICKNESS });
        }
    },

    addCutout: () => {
        const shape = STATE.selectedShape;
        const { cutouts } = Input.activeFaceData();
        if (cutouts) cutouts.push({ x: 2, y: 0, w: 2, h: 1, depth: shape ? shape.thickness : CONFIG.DEFAULT_THICKNESS });
    },

    removeJoinery: (type, index) => {
        const data = Input.activeFaceData();
        const list = type === 'cutout' ? data.cutouts : data.tenons;
        if (list) list.splice(index, 1);
    },

    calculateMirrorPosition: (shape, tenons) => {
        const last = tenons[tenons.length - 1];
        const pts = shape.points;
        const scale = CONFIG.SCALE_PIXELS_PER_INCH;
        const startPt = pts[0];
        
        let cx = 0, cy = 0;
        pts.forEach(p => { cx += p.x; cy += p.y; });
        cx /= pts.length; cy /= pts.length;

        const lastCenter = { x: startPt.x + (last.x + last.w / 2) * scale, y: startPt.y + (last.y + last.h / 2) * scale };
        return { x: cx - (lastCenter.x - cx), y: cy - (lastCenter.y - cy) };
    }
};
