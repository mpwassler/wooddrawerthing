/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store } from './store.js';
import { STATE } from './state.js';
import { DOMRenderer } from '../systems/dom-renderer.js';

// Mock DOM elements to prevent execution of document.getElementById
vi.mock('../core/dom.js', () => ({
    DOM: {
        propPanel: { classList: { add: vi.fn(), remove: vi.fn() } },
        propName: { value: '' },
        propThickness: { value: '' },
        propLength: { textContent: '' },
        faceLabel: { innerText: '' },
        joineryList: { innerHTML: '' }
    }
}));

// Mock the DOMRenderer dependency
vi.mock('../systems/dom-renderer.js', () => ({
    DOMRenderer: {
        updatePropertiesPanel: vi.fn(),
    }
}));

// Mock the 3D renderer to avoid errors
STATE.renderer3D = {
    clear3D: vi.fn(),
    render3DScene: vi.fn()
};
STATE.ui.is3DOpen = false;

describe('Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset basic state
        STATE.ui.selectedShapeId = 'test-shape';
        STATE.document.shapes = [{ id: 'test-shape', thickness: 1.0 }];
    });

    it('updates properties panel when SHAPE_THICKNESS_DRAG is dispatched', () => {
        // Init store listeners
        Store.init();

        const action = 'SHAPE_THICKNESS_DRAG';
        const payload = {
            document: { shapes: [{ id: 'test-shape', thickness: 1.5 }] },
            ui: { dragging: { active: true } }
        };

        Store.dispatch(action, payload);

        // The bug: This expectation should fail because the Store currently
        // only updates the panel if payload.ui.selectedShapeId is present.
        expect(DOMRenderer.updatePropertiesPanel).toHaveBeenCalled();
    });
});
