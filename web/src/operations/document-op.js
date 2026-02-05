/**
 * @fileoverview Document Operations
 * Handles high-level document actions like JSON sync, shape deletion, and property changes.
 */

import { STATE } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { Store } from '../core/store.js';

export const DocumentOp = {
    updateJSONExport: () => {
        const shape = STATE.selectedShape;
        if (!shape) {
            DOM.propJson.value = "";
            return;
        }
        const exportData = structuredClone(shape);
        DOM.propJson.value = JSON.stringify(exportData, null, 2);
    },

    handleJSONImport: () => {
        const shape = STATE.selectedShape;
        if (!shape) return false;
        try {
            const imported = JSON.parse(DOM.propJson.value);
            // Ensure ID is preserved
            if (!imported.id) imported.id = shape.id;
            
            // Dispatch Update (Replacing the object or properties)
            // For now, Object.assign is easiest but we should dispatch.
            // Let's create a new shape list with the updated shape.
            const newShape = { ...shape, ...imported };
            Geometry.recalculateSideLengths(newShape.points, CONFIG.SCALE_PIXELS_PER_INCH);
            
            const newShapes = STATE.document.shapes.map(s => s.id === shape.id ? newShape : s);
            
            Store.dispatch('SHAPE_UPDATE_JSON', {
                document: { shapes: newShapes }
            });
            
            return true; 
        } catch (e) {
            DOM.propJson.style.borderColor = 'red';
            setTimeout(() => DOM.propJson.style.borderColor = '#ddd', 1000);
            return false;
        }
    },

    deleteSelectedShape: () => {
        if (!STATE.ui.selectedShapeId) return;
        const newShapes = STATE.document.shapes.filter(s => s.id !== STATE.ui.selectedShapeId);
        
        Store.dispatch('SHAPE_DELETE', {
            document: { shapes: newShapes },
            ui: { selectedShapeId: null }
        });
        
        DOM.propPanel.classList.add('hidden');
    },

    updateShapeName: (name) => {
        const shape = STATE.selectedShape;
        if (shape) {
            // We mutate for text input performance, but dispatch to notify
            shape.name = name;
            Store.dispatch('SHAPE_UPDATE_NAME', {});
            DocumentOp.updateJSONExport();
        }
    }
};