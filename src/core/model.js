/**
 * @fileoverview Data Models
 * Centralized factories for creating core data structures.
 * Ensures data consistency and default values across the application.
 */

import { CONFIG } from './config.js';
import { Geometry } from '../utils/geometry.js';

export const ShapeModel = {
    /**
     * Creates a new Shape object with standard defaults.
     * @param {Array} points - Array of {x, y} coordinates.
     * @param {string} [name] - Optional name for the part.
     * @returns {Object} A complete, valid Shape object.
     */
    create: (points, name = 'New Part') => {
        // Generate a random ID
        const id = Math.random().toString(36).substr(2, 9);
        
        const shape = {
            id: id,
            name: name,
            points: [...points], // Shallow copy points to avoid ref issues
            closed: true,
            thickness: CONFIG.DEFAULT_THICKNESS,
            activeFace: 'FRONT',
            
            // Joinery Data Container
            faceData: {
                'FRONT': { tenons: [], cutouts: [] },
                'BACK': { tenons: [], cutouts: [] }
            },
            
            // 3D Transform
            transform3D: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 }
            }
        };

        // Initialize Data for Edges
        // We do this dynamically based on the number of points
        shape.points.forEach((_, i) => {
            shape.faceData[`EDGE_${i}`] = { tenons: [], cutouts: [] };
        });

        // Pre-calculate geometry (side lengths)
        Geometry.recalculateSideLengths(shape.points, CONFIG.SCALE_PIXELS_PER_INCH);

        return shape;
    },

    /**
     * Creates a new Shape from an existing one, replacing its geometry.
     * Useful for Boolean operations where we want to keep the name/thickness 
     * but reset the edge geometry.
     */
    fromParent: (parentShape, newPoints) => {
        const newShape = ShapeModel.create(newPoints, parentShape.name);
        newShape.thickness = parentShape.thickness;
        // We specifically DO NOT copy faceData['EDGE_...'] because edge indices have changed.
        // We COULD copy 'FRONT'/'BACK' data, but even that is risky if geometry changed drastically.
        // For now, we'll copy Front/Back joinery but keep it safe.
        if (parentShape.faceData.FRONT) newShape.faceData.FRONT = structuredClone(parentShape.faceData.FRONT);
        if (parentShape.faceData.BACK) newShape.faceData.BACK = structuredClone(parentShape.faceData.BACK);
        
        return newShape;
    }
};
