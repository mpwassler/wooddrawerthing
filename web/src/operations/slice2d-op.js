/**
 * @fileoverview Slice Operation (2D)
 * Handles the 2D Slice tool with angled (mitre) cuts.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { Store } from '../core/store.js';
import { ShapeModel } from '../core/model.js';

const DEFAULT_ANGLE_DEG = 90;
const MIN_ANGLE_DEG = 5;
const MAX_ANGLE_DEG = 175;
const CUT_LENGTH = 10000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const rotateVector = (vec, angleRad) => ({
    x: vec.x * Math.cos(angleRad) - vec.y * Math.sin(angleRad),
    y: vec.x * Math.sin(angleRad) + vec.y * Math.cos(angleRad)
});

const setSliceState = (updates) => {
    Store.dispatch('SLICE2D_UPDATE', {
        ui: {
            slice2D: {
                ...STATE.ui.slice2D,
                ...updates
            }
        }
    });
};

const computeCutLine = (shape, anchor, dir) => {
    if (!shape || !anchor || !dir) return null;
    const lineStart = { x: anchor.x - dir.x * CUT_LENGTH, y: anchor.y - dir.y * CUT_LENGTH };
    const lineEnd = { x: anchor.x + dir.x * CUT_LENGTH, y: anchor.y + dir.y * CUT_LENGTH };

    const intersections = [];
    for (let i = 0; i < shape.points.length; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[(i + 1) % shape.points.length];
        const hit = Geometry.lineIntersection(lineStart, lineEnd, p1, p2);
        if (hit) {
            const duplicate = intersections.some(existing => Geometry.dist(existing, hit) < 0.01);
            if (!duplicate) intersections.push(hit);
        }
    }

    if (intersections.length < 2) return null;

    let maxD = 0;
    let start = intersections[0];
    let end = intersections[1];
    for (let i = 0; i < intersections.length; i++) {
        for (let j = i + 1; j < intersections.length; j++) {
            const d = Geometry.dist(intersections[i], intersections[j]);
            if (d > maxD) {
                maxD = d;
                start = intersections[i];
                end = intersections[j];
            }
        }
    }

    return { start, end };
};

const findHoveredEdge = (mouseWorld, toleranceWorld) => {
    let best = null;
    for (let i = STATE.document.shapes.length - 1; i >= 0; i--) {
        const shape = STATE.document.shapes[i];
        if (!shape || !shape.closed || shape.points.length < 2) continue;
        for (let j = 0; j < shape.points.length; j++) {
            const p1 = shape.points[j];
            const p2 = shape.points[(j + 1) % shape.points.length];
            const closest = Geometry.closestPointOnSegment(mouseWorld, p1, p2);
            const dist = Geometry.dist(mouseWorld, closest);
            if (dist < toleranceWorld && (!best || dist < best.dist)) {
                best = {
                    shape,
                    edgeIndex: j,
                    closestPoint: closest,
                    dist
                };
            }
        }
    }
    return best;
};

const applyAngleToCut = (shape, anchor, edgeDir, angleRad) => {
    const cutDir = Geometry.normalize(rotateVector(edgeDir, angleRad));
    const activeCut = computeCutLine(shape, anchor, cutDir);
    const angleDeg = Math.abs((angleRad * 180) / Math.PI);
    setSliceState({
        activeShapeId: shape.id,
        activeCut,
        anchor,
        edgeDir,
        cutDir,
        angleDeg,
        edgeIndex: STATE.ui.slice2D.edgeIndex
    });
};

export const Slice2DOp = {
    reset: () => {
        setSliceState({
            activeShapeId: null,
            activeCut: null,
            anchor: null,
            edgeIndex: null,
            edgeDir: null,
            cutDir: null,
            angleDeg: DEFAULT_ANGLE_DEG,
            isAdjusting: false
        });
    },

    handleMouseMove: (mouseWorld, toleranceWorld) => {
        if (STATE.ui.slice2D.isAdjusting) {
            Slice2DOp.updateAngle(mouseWorld);
            return;
        }

        const hovered = findHoveredEdge(mouseWorld, toleranceWorld);
        if (!hovered) {
            setSliceState({
                activeShapeId: null,
                activeCut: null,
                anchor: null,
                edgeIndex: null,
                edgeDir: null,
                cutDir: null
            });
            return;
        }

        const { shape, edgeIndex, closestPoint } = hovered;
        const p1 = shape.points[edgeIndex];
        const p2 = shape.points[(edgeIndex + 1) % shape.points.length];
        const edgeDir = Geometry.normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
        const angleRad = Math.PI / 2;
        const cutDir = Geometry.normalize(rotateVector(edgeDir, angleRad));
        const activeCut = computeCutLine(shape, closestPoint, cutDir);

        setSliceState({
            activeShapeId: shape.id,
            activeCut,
            anchor: closestPoint,
            edgeIndex,
            edgeDir,
            cutDir,
            angleDeg: DEFAULT_ANGLE_DEG
        });
    },

    handleMouseDown: (mouseWorld, toleranceWorld) => {
        const hovered = findHoveredEdge(mouseWorld, toleranceWorld);
        if (!hovered) return;

        const { shape, edgeIndex, closestPoint } = hovered;
        const p1 = shape.points[edgeIndex];
        const p2 = shape.points[(edgeIndex + 1) % shape.points.length];
        const edgeDir = Geometry.normalize({ x: p2.x - p1.x, y: p2.y - p1.y });

        setSliceState({
            activeShapeId: shape.id,
            anchor: closestPoint,
            edgeIndex,
            edgeDir,
            isAdjusting: true
        });

        Slice2DOp.updateAngle(mouseWorld);
    },

    updateAngle: (mouseWorld) => {
        const { activeShapeId, anchor, edgeDir } = STATE.ui.slice2D;
        if (!activeShapeId || !anchor || !edgeDir) return;

        const shape = STATE.document.shapes.find(s => s.id === activeShapeId);
        if (!shape) return;

        const vec = { x: mouseWorld.x - anchor.x, y: mouseWorld.y - anchor.y };
        const len = Math.hypot(vec.x, vec.y);
        if (len < 0.001) return;

        const dirVec = { x: vec.x / len, y: vec.y / len };
        const dot = Geometry.dot(edgeDir, dirVec);
        const cross = edgeDir.x * dirVec.y - edgeDir.y * dirVec.x;
        const rawAngle = Math.atan2(cross, dot);
        const absAngle = clamp(Math.abs(rawAngle) * 180 / Math.PI, MIN_ANGLE_DEG, MAX_ANGLE_DEG);
        const signedAngle = (absAngle * Math.PI / 180) * (rawAngle >= 0 ? 1 : -1);

        applyAngleToCut(shape, anchor, edgeDir, signedAngle);
    },

    handleMouseUp: () => {
        if (!STATE.ui.slice2D.isAdjusting) return;
        setSliceState({ isAdjusting: false });
    },

    handleClick: () => {
        const { activeCut, activeShapeId } = STATE.ui.slice2D;
        if (!activeCut || !activeShapeId) return;

        const shape = STATE.document.shapes.find(s => s.id === activeShapeId);
        if (!shape) return;

        const splitPoints = Geometry.splitPolygon(shape.points, activeCut.start, activeCut.end);
        if (!splitPoints || splitPoints.length !== 2) return;

        const shapeA = ShapeModel.fromParent(shape, splitPoints[0]);
        const shapeB = ShapeModel.fromParent(shape, splitPoints[1]);

        const newShapes = STATE.document.shapes.filter(s => s.id !== shape.id);
        newShapes.push(shapeA, shapeB);

        Store.dispatch('SHAPE_SLICE_2D', {
            document: { shapes: newShapes },
            ui: { selectedShapeId: null }
        });

        Slice2DOp.reset();
    }
};
