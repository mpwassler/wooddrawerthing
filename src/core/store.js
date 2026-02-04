/**
 * @fileoverview Application Store (Flux Architecture)
 * Centralizes state mutations via an Event Bus.
 */

import { STATE } from './state.js';
import { DOMRenderer } from '../systems/dom-renderer.js';
import { ViewController } from '../systems/view-controller.js';
import { DocumentOp } from '../operations/document-op.js';

// Event Name
export const EVENT_UPDATE = 'APP_STATE_UPDATE';
export const EVENT_CHANGED = 'APP_STATE_CHANGED';

const history = [];
const MAX_HISTORY = 10;

export const Store = {
    init: () => {
        window.addEventListener(EVENT_UPDATE, Store.handleUpdate);
    },

    /**
     * Dispatches an action to update the state.
     * @param {string} action - Descriptive name of the action (e.g., 'SELECT_SHAPE')
     * @param {Object} payload - Partial state object to merge { ui: {...}, document: {...} }
     * @param {boolean} shouldPersist - Whether to save the current state to history before applying this update
     */
    dispatch: (action, payload, shouldPersist = false) => {
        const event = new CustomEvent(EVENT_UPDATE, { 
            detail: { action, payload, shouldPersist } 
        });
        window.dispatchEvent(event);
    },

    undo: () => {
        if (history.length === 0) return;
        const previousState = history.pop();
        console.log(`[Store] Undoing... (${history.length} snapshots remaining)`);
        
        // Restore document and UI state
        Store.dispatch('HISTORY_UNDO', { 
            document: previousState.document,
            ui: { 
                ...previousState.ui,
                selectedShapeId: null 
            }
        }, false);
        
        console.log(`[Store] Undo complete. Current shapes: ${STATE.document.shapes.length}`);
    },

    handleUpdate: (e) => {
        const { action, payload, shouldPersist } = e.detail;
        
        console.log(`[Store] Action: ${action}`, payload);

        // 0. Snapshot for History (BEFORE modification)
        if (shouldPersist) {
            // Deep clone the document state
            const docSnapshot = structuredClone(STATE.document);
            delete docSnapshot.currentProject;
            delete docSnapshot.shapes;

            const uiSnapshot = {
                activeDrawing: structuredClone(STATE.ui.activeDrawing),
                drawState: STATE.ui.drawState
            };
            
            history.push({ document: docSnapshot, ui: uiSnapshot });
            if (history.length > MAX_HISTORY) {
                history.shift(); // Remove oldest
            }
        }

        // 1. Merge State (Deep Merge simplified)
        if (payload.ui) {
            Object.assign(STATE.ui, payload.ui);
        }
        if (payload.document) {
            // Document updates usually require more care (arrays), but for top-level props:
            Object.assign(STATE.document, payload.document);
        }

        // 2. React to Changes (The "Render Loop")
        
        // Update UI Panels
        if ((payload.ui && payload.ui.selectedShapeId !== undefined) || action === 'SHAPE_THICKNESS_DRAG' || action === 'HISTORY_UNDO') {
            DOMRenderer.updatePropertiesPanel(STATE.selectedShape);
        }
        
        // Update 3D View (if open)
        // Skip rebuild for 3D-specific actions where the view is already consistent
        if (STATE.ui.is3DOpen && STATE.renderer3D) {
            const skip3DRebuild = ['SHAPE_TRANSFORM_3D', 'SELECT_SHAPE_3D', 'DESELECT_3D'].includes(action);
            
            if (!skip3DRebuild) {
                STATE.renderer3D.clear3D();
                STATE.renderer3D.render3DScene(STATE.document.shapes);
            }
        }

        // Auto-Save check could go here
        
        // 3. Notify others
        window.dispatchEvent(new CustomEvent(EVENT_CHANGED, { detail: { action } }));
    }
};
