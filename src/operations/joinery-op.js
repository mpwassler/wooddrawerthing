/**
 * @fileoverview Joinery Operations
 * Logic for adding and managing tenons and cutouts.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';

export const JoineryOp = {
    addTenon: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        
        const tenons = shape.tenons;
        if (tenons.length > 0) {
            // Mirroring logic
            const last = tenons[tenons.length - 1];
            const pts = shape.points;
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const startPt = pts[0];
            
            let cx = 0, cy = 0;
            pts.forEach(p => { cx += p.x; cy += p.y; });
            cx /= pts.length; cy /= pts.length;

            const lastCenter = { x: startPt.x + (last.x + last.w / 2) * scale, y: startPt.y + (last.y + last.h / 2) * scale };
            const target = { x: cx - (lastCenter.x - cx), y: cy - (lastCenter.y - cy) };

            let bestPt = null, minD = Infinity;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                const closest = Geometry.closestPointOnSegment(target, p1, p2);
                const d = Geometry.dist(target, closest);
                if (d < minD) { minD = d; bestPt = closest; }
            }

            if (bestPt) {
                tenons.push({
                    x: (bestPt.x - scale * last.w / 2 - startPt.x) / scale,
                    y: (bestPt.y - scale * last.h / 2 - startPt.y) / scale,
                    w: last.w, h: last.h, inset: last.inset || 0
                });
            }
        } else {
            tenons.push({ x: 0, y: 0, w: 2, h: 2, inset: 0 });
        }
    },

    addCutout: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        shape.cutouts.push({ x: 2, y: 2, w: 2, h: 4 });
    },

    removeJoinery: (type, index) => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        const list = type === 'cutout' ? shape.cutouts : shape.tenons;
        list.splice(index, 1);
    }
};
