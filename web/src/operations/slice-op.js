/**
 * @fileoverview Slice Operation
 * Handles the "Loop Slice" tool in 3D mode.
 */

import { STATE } from '../core/state.js';
import * as THREE from 'https://esm.sh/three@0.160.0';
import { Geometry } from '../utils/geometry.js';
import { Store } from '../core/store.js';
import { CONFIG } from '../core/config.js';
import { ShapeModel } from '../core/model.js';

export const SliceOp = {
    previewLine: null,
    activeCut: null, 
    activeShapeId: null,

    handleMouseMove: (e, raycaster, intersects) => {
        SliceOp.clearPreview();
        if (intersects.length === 0) return;

        let hitObj = intersects[0].object;
        let group = hitObj;
        while (group && !group.userData.shapeId) {
            group = group.parent;
        }
        if (!group || !group.userData.shapeId) return;

        const shape = STATE.document.shapes.find(s => s.id === group.userData.shapeId);
        if (!shape) return;

        const worldPoint = intersects[0].point;
        const localPoint = group.worldToLocal(worldPoint.clone());
        const centroid = Geometry.calculateCentroid(shape.points);
        const pt2D = { x: localPoint.x + centroid.x, y: -localPoint.y + centroid.y };

        let bestEdge = null;
        let minDist = Infinity;
        const pts = shape.points;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            const closestOnSeg = Geometry.closestPointOnSegment(pt2D, p1, p2);
            const dist = Geometry.dist(pt2D, closestOnSeg);
            if (dist < minDist) { minDist = dist; bestEdge = { p1, p2 }; }
        }
        if (!bestEdge) return;

        const dx = bestEdge.p2.x - bestEdge.p1.x, dy = bestEdge.p2.y - bestEdge.p1.y;
        const len = Math.hypot(dx, dy);
        const perp = { x: -dy / len, y: dx / len };
        
        const intersections = [];
        for (let i = 0; i < pts.length; i++) {
            const hit = Geometry.lineIntersection(pt2D, { x: pt2D.x + perp.x * 10000, y: pt2D.y + perp.y * 10000 }, pts[i], pts[(i + 1) % pts.length]);
            if (hit) intersections.push(hit);
            const hitBack = Geometry.lineIntersection(pt2D, { x: pt2D.x - perp.x * 10000, y: pt2D.y - perp.y * 10000 }, pts[i], pts[(i + 1) % pts.length]);
            if (hitBack) intersections.push(hitBack);
        }

        if (intersections.length >= 2) {
            let maxD = 0, start = intersections[0], end = intersections[1];
            for(let i=0; i<intersections.length; i++) {
                for(let j=i+1; j<intersections.length; j++) {
                    const d = Geometry.dist(intersections[i], intersections[j]);
                    if (d > maxD) { maxD = d; start = intersections[i]; end = intersections[j]; }
                }
            }
            
            SliceOp.activeCut = { start, end };
            SliceOp.activeShapeId = shape.id;
            
            // 5. Render Preview (Laser Cut Plane)
            const scale = CONFIG.SCALE_PIXELS_PER_INCH;
            const thickness = (shape.thickness || CONFIG.DEFAULT_THICKNESS) * scale;
            
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const cutLen = Geometry.dist(start, end);
            const angle = Math.atan2(end.y - start.y, end.x - start.x);

            // Create a "Laser Sheet"
            // Width = Cut Length + Overhang
            // Height = Thickness * 2 (to clearly cut through)
            // Depth = Thin (0.5)
            const geo = new THREE.BoxGeometry(cutLen + 20, 0.5, thickness * 2);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.5,
                // depthTest: false // Draw through object
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            // Transform to Visual Space (Flipped Y)
            // Data Y is positive, Visual Y is negative.
            // Angle also needs to be mirrored.
            mesh.position.set(midX - centroid.x, -(midY - centroid.y), thickness / 2);
            mesh.rotation.z = -angle;
            
            group.add(mesh);
            SliceOp.previewLine = mesh;
        }
    },

    clearPreview: () => {
        if (SliceOp.previewLine) {
            SliceOp.previewLine.parent.remove(SliceOp.previewLine);
            SliceOp.previewLine.geometry.dispose();
            SliceOp.previewLine = null;
        }
        SliceOp.activeCut = null;
    },

    handleClick: () => {
        if (SliceOp.activeCut && SliceOp.activeShapeId) {
            const shape = STATE.document.shapes.find(s => s.id === SliceOp.activeShapeId);
            if (!shape) return;

            const splitPoints = Geometry.splitPolygon(shape.points, SliceOp.activeCut.start, SliceOp.activeCut.end);
            
            if (splitPoints && splitPoints.length === 2) {
                const shapeA = ShapeModel.fromParent(shape, splitPoints[0]);
                const shapeB = ShapeModel.fromParent(shape, splitPoints[1]);
                
                const newShapes = STATE.document.shapes.filter(s => s.id !== shape.id);
                newShapes.push(shapeA, shapeB);

                Store.dispatch('SHAPE_SLICE', {
                    document: { shapes: newShapes },
                    ui: { selectedShapeId: null }
                });

                SliceOp.clearPreview();
            }
        }
    }
};