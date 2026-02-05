import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { Store } from '../core/store.js';

export const SelectionOp = {
    handleSelect: (isMultiSelect) => {
        // Find shape under cursor
        const { hoveredShapeId } = STATE.ui;
        
        if (hoveredShapeId) {
            Store.dispatch('SELECT_SHAPE', { ui: { selectedShapeId: hoveredShapeId } });
        } else {
            Store.dispatch('DESELECT', { ui: { selectedShapeId: null } });
        }
    },

    updateHoverState: (mouseWorld) => {
        // Simple hit test
        let found = null;
        // Check in reverse order (top to bottom)
        for (let i = STATE.document.shapes.length - 1; i >= 0; i--) {
            const shape = STATE.document.shapes[i];
            
            // Bounding box check first for speed (optimization for later)
            
            if (SelectionOp.pointInPolygon(mouseWorld, shape.points)) {
                found = shape;
                break;
            }
        }

        if (found) {
            if (STATE.ui.hoveredShapeId !== found.id) {
                Store.dispatch('HOVER_SHAPE', { ui: { hoveredShapeId: found.id } });
            }
        } else {
            if (STATE.ui.hoveredShapeId !== null) {
                Store.dispatch('HOVER_CLEAR', { ui: { hoveredShapeId: null } });
            }
        }
    },

    pointInPolygon: (p, points) => {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
};