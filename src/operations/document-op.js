/**
 * @fileoverview Document Operations
 * Handles high-level document actions like JSON sync, shape deletion, and property changes.
 */

import { STATE } from '../core/state.js';
import { DOM } from '../core/dom.js';

export const DocumentOp = {
    updateJSONExport: () => {
        const shape = STATE.selectedShape;
        if (!shape) {
            DOM.propJson.value = "";
            return;
        }
        const exportData = JSON.parse(JSON.stringify(shape));
        DOM.propJson.value = JSON.stringify(exportData, null, 2);
    },

    handleJSONImport: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        try {
            const imported = JSON.parse(DOM.propJson.value);
            // Ensure ID is preserved if not provided in JSON
            if (!imported.id) imported.id = shape.id;
            Object.assign(shape, imported);
            // After import, we might need a full UI refresh which is usually handled by the main loop
            // but we call the panel update to be sure.
            return true; 
        } catch (e) {
            DOM.propJson.style.borderColor = 'red';
            setTimeout(() => DOM.propJson.style.borderColor = '#ddd', 1000);
            return false;
        }
    },

    deleteSelectedShape: () => {
        if (!STATE.ui.selectedShapeId) return;
        STATE.document.shapes = STATE.document.shapes.filter(s => s.id !== STATE.ui.selectedShapeId);
        STATE.ui.selectedShapeId = null;
        DOM.propPanel.classList.add('hidden');
    },

    updateShapeName: (name) => {
        const shape = STATE.selectedShape;
        if (shape) {
            shape.name = name;
            DocumentOp.updateJSONExport();
        }
    }
};
