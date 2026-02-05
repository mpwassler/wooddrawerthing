/**
 * @fileoverview Boolean Operations Utility
 * Provides Union and Subtract operations for polygons using 'polygon-clipping' library.
 */

import polygonClipping from 'https://esm.sh/polygon-clipping';

export const BooleanOps = {
    /**
     * Converts internal Shape object to GeoJSON-like Polygon format.
     * @param {Object} shape - Internal shape object
     * @returns {Array} - [[[x,y], [x,y]...]]
     */
    toPolygon: (shape) => {
        const ring = shape.points.map(p => [p.x, p.y]);
        // Close ring if needed
        if (ring.length > 0) {
             const start = ring[0];
             const end = ring[ring.length - 1];
             if (start[0] !== end[0] || start[1] !== end[1]) {
                 ring.push(start);
             }
        }
        return [ring];
    },

    /**
     * Converts GeoJSON-like Polygon back to internal Shape points.
     * @param {Array} poly - [[[x,y], [x,y]...]]
     * @returns {Array} - [{x,y}...]
     */
    fromPolygon: (poly) => {
        if (!poly || poly.length === 0 || poly[0].length === 0) return [];
        // Take the first ring (outer boundary)
        // Ignoring holes for now as our internal model handles holes via "cutouts" property, 
        // but complex polygons might need a different data structure later.
        // For basic "Union", we assume result is a single polygon.
        const ring = poly[0]; 
        // Remove closing point
        return ring.slice(0, ring.length - 1).map(p => ({ x: p[0], y: p[1] }));
    },

    /**
     * Performs Union of two shapes.
     */
    union: (shapeA, shapeB) => {
        const polyA = BooleanOps.toPolygon(shapeA);
        const polyB = BooleanOps.toPolygon(shapeB);
        
        const result = polygonClipping.union(polyA, polyB);
        
        // Result is MultiPolygon: [[[[x,y]...]]]
        // We take the largest polygon if multiple are returned (e.g. disjoint union), or just the first.
        // For simple "Add", they should be overlapping, so 1 polygon.
        
        if (result.length === 0) return null;
        
        // Flatten MultiPolygon structure
        // result[0] is the first Polygon
        // result[0][0] is the outer ring of that Polygon
        return BooleanOps.fromPolygon(result[0]);
    },

    /**
     * Performs Subtraction (A - B).
     */
    subtract: (shapeA, shapeB) => {
        const polyA = BooleanOps.toPolygon(shapeA);
        const polyB = BooleanOps.toPolygon(shapeB);
        
        const result = polygonClipping.difference(polyA, polyB);
        
        if (result.length === 0) return null;
        return BooleanOps.fromPolygon(result[0]);
    },
    
    /**
     * Checks if A and B intersect (Simple AABB check for speed).
     */
    checkIntersection: (shapeA, shapeB) => {
        const getBounds = (pts) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            return { minX, minY, maxX, maxY };
        };
        
        const bA = getBounds(shapeA.points);
        const bB = getBounds(shapeB.points);
        
        return !(bB.minX > bA.maxX || 
                 bB.maxX < bA.minX || 
                 bB.minY > bA.maxY || 
                 bB.maxY < bA.minY);
    }
};
