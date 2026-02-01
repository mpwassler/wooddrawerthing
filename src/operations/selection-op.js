/**
 * @fileoverview Selection Operations
 * Handles hit-testing, hovering, and selecting shapes.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';

export const SelectionOp = {
    updateHoverState: (mouseWorld) => {
        const shapesRev = [...STATE.document.shapes].reverse();
        STATE.ui.hoveredShapeId = null;
        DOM.canvas.style.cursor = 'default';

        for (const shape of shapesRev) {
            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[(i + 1) % shape.points.length];
                if (!shape.closed && i === shape.points.length - 1) continue;

                const l2 = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
                if (l2 === 0) continue;
                
                const t = Math.max(0, Math.min(1, ((mouseWorld.x - p1.x) * (p2.x - p1.x) + (mouseWorld.y - p1.y) * (p2.y - p1.y)) / l2));
                const proj = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
                
                if (Geometry.dist(mouseWorld, proj) * STATE.ui.view.zoom < CONFIG.CLICK_TOLERANCE_SCREEN_PX) {
                    STATE.ui.hoveredShapeId = shape.id;
                    DOM.canvas.style.cursor = 'pointer';
                    return;
                }
            }
        }
    },

    handleSelect: (ctrlKey) => {
        if (STATE.ui.hoveredShapeId) {
            STATE.ui.selectedShapeId = STATE.ui.hoveredShapeId;
        } else if (!ctrlKey) {
            STATE.ui.selectedShapeId = null;
        }
    }
};
