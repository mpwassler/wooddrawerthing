/**
 * @fileoverview Joinery Operations
 * Logic for adding and managing tenons and cutouts.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { Input } from '../systems/input.js';
import { TenonModel, CutoutModel } from '../core/model.js';
import { Store } from '../core/store.js';

export const JoineryOp = {
    /**
     * Adds a new Tenon to the currently selected shape and face.
     */
    addTenon: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        
        // Clone for immutability
        const newShape = structuredClone(shape);
        const activeFace = shape.activeFace || 'FRONT';
        const faceData = newShape.faceData[activeFace] || { tenons: [], cutouts: [] };
        // Ensure structure exists if it was missing
        if (!newShape.faceData[activeFace]) newShape.faceData[activeFace] = faceData;
        
        const tenons = faceData.tenons || [];
        faceData.tenons = tenons;
        
        const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
        
        // Calculate Position
        if (tenons.length > 0) {
            if (activeFace === 'FRONT') {
                const target = JoineryOp.calculateMirrorPosition(shape, tenons); // Use original shape for calc
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
                    tenons.push(TenonModel.create(
                        (bestPt.x - scale * last.w / 2 - startPt.x) / scale,
                        (bestPt.y - scale * last.h / 2 - startPt.y) / scale,
                        last.w, last.h, thickness, last.inset || 0
                    ));
                }
            } else {
                const last = tenons[tenons.length - 1];
                tenons.push(TenonModel.create(last.x + 2, 0, 2, 1, thickness, 0));
            }
        } else {
            tenons.push(TenonModel.create(0, 0, 2, 1, thickness, 0));
        }

        // Dispatch Update
        const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
        Store.dispatch('JOINERY_ADD', { document: { shapes: newShapes } });
    },

    /**
     * Adds a new Cutout to the currently selected shape and face.
     */
    addCutout: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;

        const newShape = structuredClone(shape);
        const activeFace = shape.activeFace || 'FRONT';
        const faceData = newShape.faceData[activeFace] || { tenons: [], cutouts: [] };
        if (!newShape.faceData[activeFace]) newShape.faceData[activeFace] = faceData;

        const cutouts = faceData.cutouts || [];
        faceData.cutouts = cutouts;
        
        const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
        cutouts.push(CutoutModel.create(2, 0, 2, 1, thickness));

        const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
        Store.dispatch('JOINERY_ADD', { document: { shapes: newShapes } });
    },

    /**
     * Removes a joinery item (tenon or cutout) from the list.
     */
    removeJoinery: (type, index) => {
        const shape = STATE.selectedShape;
        if (!shape) return;

        const newShape = structuredClone(shape);
        const activeFace = shape.activeFace || 'FRONT';
        const faceData = newShape.faceData[activeFace];
        if (!faceData) return;

        const list = type === 'cutout' ? faceData.cutouts : faceData.tenons;
        if (list) list.splice(index, 1);

        const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
        Store.dispatch('JOINERY_REMOVE', { document: { shapes: newShapes } });
    },

    /**
     * Calculates the mirrored position for a new tenon based on the last added one.
     * Used for symmetric placement on the Front face.
     * @returns {Object} Target point {x, y}
     */
    calculateMirrorPosition: (shape, tenons) => {
        const last = tenons[tenons.length - 1];
        const scale = CONFIG.SCALE_PIXELS_PER_INCH;
        const startPt = shape.points[0];
        
        const centroid = Geometry.calculateCentroid(shape.points);

        const lastCenter = { x: startPt.x + (last.x + last.w / 2) * scale, y: startPt.y + (last.y + last.h / 2) * scale };
        return { x: centroid.x - (lastCenter.x - centroid.x), y: centroid.y - (lastCenter.y - centroid.y) };
    }
};