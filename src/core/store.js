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

export const Store = {
    init: () => {
        window.addEventListener(EVENT_UPDATE, Store.handleUpdate);
    },

    /**
     * Dispatches an action to update the state.
     * @param {string} action - Descriptive name of the action (e.g., 'SELECT_SHAPE')
     * @param {Object} payload - Partial state object to merge { ui: {...}, document: {...} }
     */
    dispatch: (action, payload) => {
        const event = new CustomEvent(EVENT_UPDATE, { 
            detail: { action, payload } 
        });
        window.dispatchEvent(event);
    },

    handleUpdate: (e) => {
        const { action, payload } = e.detail;
        
        //console.log(`[Store] Action: ${action}`, payload);

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
        if ((payload.ui && payload.ui.selectedShapeId !== undefined) || action === 'SHAPE_THICKNESS_DRAG') {
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
