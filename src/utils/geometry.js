/**
 * @fileoverview Geometry & Math Utilities
 * Pure functions for vector math and unit conversion.
 */

import { CONFIG } from '../core/config.js';

export const Geometry = {
    /** Calculates Euclidean distance between two points */
    dist: (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y),

    /** Transforms screen coordinates to world coordinates */
    screenToWorld: (pos, view) => ({
        x: (pos.x - view.pan.x) / view.zoom,
        y: (pos.y - view.pan.y) / view.zoom,
    }),

    /** Transforms world coordinates to screen coordinates */
    worldToScreen: (pos, view) => ({
        x: pos.x * view.zoom + view.pan.x,
        y: pos.y * view.zoom + view.pan.y,
    }),

    /** Normalizes a vector {x, y} */
    normalize: (vec) => {
        const mag = Math.hypot(vec.x, vec.y) || 1;
        return { x: vec.x / mag, y: vec.y / mag };
    },

    /** Dot product */
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,

    /** GCD for fractions */
    gcd: (a, b) => b === 0 ? a : Geometry.gcd(b, a % b),

    /** Formats decimal inches to feet/inch fraction string */
    formatInches: (val) => {
        if (val < 1 / 64) return `0"`;
        const intInches = Math.floor(val);
        const frac = val - intInches;
        let fracStr = '';

        if (frac > 1 / 64) {
            const den = 16;
            let num = Math.round(frac * den);
            if (num > 0) {
                if (num === den) return `${intInches + 1}"`;
                const div = Geometry.gcd(num, den);
                fracStr = ` ${num / div}/${den / div}`;
            }
        }
        return `${intInches}${fracStr}"`.trim();
    },

    /** Parses measurement string to decimal inches */
    parseMeasurement: (str) => {
        str = str.trim();
        const feetInches = /(\d+)'(?:\s*(\d+)?(?:\s*(\d+)\/(\d+))?)?"?/;
        const inchesOnly = /(\d+)?(?:\s*(\d+)\/(\d+))?"?/;
        
        let m = str.match(feetInches);
        if (m) {
            const ft = parseInt(m[1] || 0, 10);
            const inch = parseInt(m[2] || 0, 10);
            const num = parseInt(m[3] || 0, 10);
            const den = parseInt(m[4] || 1, 10);
            return (ft * 12) + inch + (num / den);
        }
        m = str.match(inchesOnly);
        if (m && (m[1] || m[2])) {
            const inch = parseInt(m[1] || 0, 10);
            const num = parseInt(m[2] || 0, 10);
            const den = parseInt(m[3] || 1, 10);
            return inch + (num / den);
        }
        const flt = parseFloat(str.replace(/["']/g, ''));
        return isNaN(flt) ? null : flt;
    },

    /**
     * Returns the closest point on a line segment (p1-p2) to point p.
     */
    closestPointOnSegment: (p, p1, p2) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return p1;

        const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);
        
        // Clamp t to segment
        const tClamped = Math.max(0, Math.min(1, t));
        
        return {
            x: p1.x + tClamped * dx,
            y: p1.y + tClamped * dy
        };
    },

    /**
     * Recalculates lengthToNext for all points in a closed shape.
     */
    recalculateSideLengths: (points, scale) => {
        if (!points || points.length < 2) return;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const dist = Geometry.dist(p1, p2);
            p1.lengthToNext = dist / scale;
        }
    }
};