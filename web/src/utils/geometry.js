/**
 * @fileoverview Geometry & Math Utilities
 * 
 * TEACHING MOMENT:
 * This file contains "Pure Functions". They don't touch the DOM or the State.
 * They just take numbers in and spit numbers out. This makes them easy to test
 * and safe to use anywhere.
 */

import { CONFIG } from '../core/config.js';

export const Geometry = {
    /** 
     * Calculates the distance between two points.
     * THEORY: The Pythagorean Theorem (a² + b² = c²).
     * We calculate the difference in X and Y (a and b), square them, add them,
     * and take the square root to find the diagonal distance (c).
     */
    dist: (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y),

    /** 
     * Transforms "Screen Coordinates" (pixels on your monitor) into "World Coordinates" (inches in the design).
     * THEORY: Coordinate Transformation.
     * 1. Translate: Subtract the pan offset to align the origins.
     * 2. Scale: Divide by the zoom factor to reverse the magnification.
     */
    screenToWorld: (pos, view) => ({
        x: (pos.x - view.pan.x) / view.zoom,
        y: (pos.y - view.pan.y) / view.zoom,
    }),

    /** 
     * Transforms "World Coordinates" back into "Screen Coordinates".
     * This is the inverse of screenToWorld. We Scale first, then Translate.
     */
    worldToScreen: (pos, view) => ({
        x: pos.x * view.zoom + view.pan.x,
        y: pos.y * view.zoom + view.pan.y,
    }),

    /** 
     * Normalizes a vector.
     * THEORY: Unit Vectors.
     * A "Vector" has both Direction and Magnitude (Length).
     * Sometimes we only care about Direction (e.g., "Going North").
     * Normalizing divides a vector by its own length, resulting in a length of 1.
     * This is crucial for direction calculations like Dot Products.
     */
    normalize: (vec) => {
        const mag = Math.hypot(vec.x, vec.y) || 1; // Avoid division by zero
        return { x: vec.x / mag, y: vec.y / mag };
    },

    /** 
     * Calculates the Dot Product of two vectors.
     * THEORY: Projection / "The Shadow".
     * The Dot Product tells us how much two vectors point in the same direction.
     * - If A and B are normalized:
     *   - Result 1.0: They point in the exact same direction.
     *   - Result 0.0: They are perpendicular (90 degrees).
     *   - Result -1.0: They point in opposite directions.
     * 
     * PRACTICAL USE: We use this to project the mouse cursor onto a guide line
     * to see how far along that line we have moved.
     */
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,

    /** 
     * Greatest Common Divisor (GCD).
     * Used for simplifying fractions (e.g., converting 4/8 to 1/2).
     */
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

    /** Parses measurement string (e.g., "1' 2 1/2") to decimal inches */
    parseMeasurement: (str) => {
        str = str.trim();
        if (!str) return null;
        
        // 1. Check for Feet-based format: 1' 2 1/2"
        const feetMatch = str.match(/^(\d+)'(?:\s*(\d+)?(?:\s*(\d+)\/(\d+))?)?"?$/);
        if (feetMatch) {
            const ft = parseInt(feetMatch[1], 10);
            const inch = parseInt(feetMatch[2] || 0, 10);
            const num = parseInt(feetMatch[3] || 0, 10);
            const den = parseInt(feetMatch[4] || 1, 10);
            return (ft * 12) + inch + (num / den);
        }

        // 2. Check for Mixed Inches: 1 1/2"
        const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)"?$/);
        if (mixedMatch) {
            const inch = parseInt(mixedMatch[1], 10);
            const num = parseInt(mixedMatch[2], 10);
            const den = parseInt(mixedMatch[3], 10);
            return inch + (num / den);
        }

        // 3. Check for Pure Fraction: 1/2"
        const fractionMatch = str.match(/^(\d+)\/(\d+)"?$/);
        if (fractionMatch) {
            return parseInt(fractionMatch[1], 10) / parseInt(fractionMatch[2], 10);
        }

        // 4. Check for Plain Integer/Decimal: 12" or 12.5"
        const plainMatch = str.match(/^(\d+(?:\.\d+)?)"?$/);
        if (plainMatch) {
            return parseFloat(plainMatch[1]);
        }

        return null;
    },

    /**
     * Finds the closest point on a line segment to an arbitrary point.
     * THEORY: Parametric Line Equations.
     * A line segment is defined as: Point = Start + t * (End - Start)
     * where 't' goes from 0 (Start) to 1 (End).
     * 
     * We calculate 't' by projecting our point onto the line vector (using Dot Product!).
     * Then we CLAMP 't' between 0 and 1.
     * - If t < 0: The closest point is the Start.
     * - If t > 1: The closest point is the End.
     * - Otherwise: It's somewhere in the middle.
     */
    closestPointOnSegment: (p, p1, p2) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return p1; // Segment is actually a dot

        // Calculate 't' (the projection ratio)
        const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);
        
        // Clamp 't' to the segment bounds [0, 1]
        const tClamped = Math.max(0, Math.min(1, t));
        
        return {
            x: p1.x + tClamped * dx,
            y: p1.y + tClamped * dy
        };
    },

    /**
     * Splits a polygon into two parts using a line segment.
     * Assumes the segment crosses the entire polygon.
     */
    splitPolygon: (pts, cutStart, cutEnd) => {
        // 1. Find indices of segments that contain the cut points
        const findSegment = (p) => {
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                const d = Geometry.dist(p, Geometry.closestPointOnSegment(p, p1, p2));
                if (d < 0.01) return i;
            }
            return -1;
        };

        const idx1 = findSegment(cutStart);
        const idx2 = findSegment(cutEnd);

        if (idx1 === -1 || idx2 === -1 || idx1 === idx2) return null;

        // 2. Create two new loops
        // Loop A: Start at CutStart -> segments to CutEnd -> CutEnd -> back to CutStart
        // Loop B: Start at CutEnd -> segments to CutStart -> CutStart -> back to CutEnd

        const part1 = [cutStart];
        let curr = (idx1 + 1) % pts.length;
        while (curr !== (idx2 + 1) % pts.length) {
            part1.push(pts[curr]);
            curr = (curr + 1) % pts.length;
        }
        part1.push(cutEnd);

        const part2 = [cutEnd];
        curr = (idx2 + 1) % pts.length;
        while (curr !== (idx1 + 1) % pts.length) {
            part2.push(pts[curr]);
            curr = (curr + 1) % pts.length;
        }
        part2.push(cutStart);

        return [part1, part2];
    },

    /**
     * Calculates the intersection point of two line segments.
     * Returns {x, y} or null if no intersection.
     */
    lineIntersection: (p1, p2, p3, p4) => {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
        if (det === 0) return null; // Parallel

        const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
        const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

        if ((0 <= lambda && lambda <= 1) && (0 <= gamma && gamma <= 1)) {
            return {
                x: p1.x + lambda * (p2.x - p1.x),
                y: p1.y + lambda * (p2.y - p1.y)
            };
        }
        return null;
    },

    /**
     * Calculates the geometric center of a set of points.
     */
    calculateCentroid: (points) => {

        if (!points || points.length === 0) return { x: 0, y: 0 };
        let cx = 0, cy = 0;
        points.forEach(p => { cx += p.x; cy += p.y; });
        return { x: cx / points.length, y: cy / points.length };
    },

    /**
     * Calculates the center of the Axis-Aligned Bounding Box (AABB).
     * Better for visual pivots than vertex centroid.
     */
    calculateBoundingCenter: (points) => {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    },

    /**
     * Helper to handle the "Multi-Side" coordinate logic.
     * THEORY: Local Coordinate Systems.
     * - FRONT: Standard World Coordinates.
     * - BACK: Mirrored horizontally around the shape's center (x' = 2*cx - x).
     * - EDGE: A totally new 2D plane where X = Edge Length and Y = Thickness.
     * 
     * This function abstracts that complexity so the renderer doesn't have to know math.
     */
    getFaceOrigin: (shape, faceName, scale) => {
        const centroid = Geometry.calculateCentroid(shape.points);
        
        // Default Front
        if (!faceName || faceName === 'FRONT') {
            return { origin: shape.points[0], xMult: 1 };
        }

        if (faceName === 'BACK') {
            return { 
                origin: { x: 2 * centroid.x - shape.points[0].x, y: shape.points[0].y }, 
                xMult: -1 
            };
        }

        if (faceName.startsWith('EDGE_')) {
            const idx = parseInt(faceName.split('_')[1]);
            const len = shape.points[idx].lengthToNext || 0;
            const thick = shape.thickness || 1.0; 
            // Center the edge rectangle on the shape's centroid for display
            return {
                origin: { x: centroid.x - (len * scale) / 2, y: centroid.y - (thick * scale) / 2 },
                xMult: 1
            };
        }

        return { origin: shape.points[0], xMult: 1 };
    },

    /**
     * Pre-calculates the length of each side of a polygon.
     * Useful for caching so we don't recalculate distance every frame.
     */
    recalculateSideLengths: (points, scale) => {
        if (!points || points.length < 2) return;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const dist = Geometry.dist(p1, p2);
            p1.lengthToNext = dist / scale;
        }
    },

    /**
     * Calculates the Area of a polygon.
     * THEORY: The Shoelace Formula (Surveyor's Formula).
     * We iterate through the points and calculate the "Cross Product" of each edge.
     * Summing these up gives us 2x the Area.
     * 
     * Why does it work? 
     * Imagine calculating the area of the trapezoid under every single edge down to the X-axis.
     * Some edges go "forward" (adding area), some go "backward" (subtracting area).
     * The result is the area exactly inside the polygon.
     */
    calculateArea: (points, scale) => {
        if (!points || points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            // Cross product step: (x1 * y2) - (x2 * y1)
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2 / (scale * scale);
    }
};
