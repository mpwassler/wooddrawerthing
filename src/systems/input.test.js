/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input } from './input.js';
import { STATE } from '../core/state.js';
import { SelectionOp } from '../operations/selection-op.js';
import { ViewportOp } from '../operations/viewport-op.js';
import { DrawingOp } from '../operations/drawing-op.js';

// Mock Dependencies
vi.mock('../operations/selection-op.js', () => ({
    SelectionOp: {
        handleSelect: vi.fn(),
        updateHoverState: vi.fn()
    }
}));

vi.mock('../operations/viewport-op.js', () => ({
    ViewportOp: {
        startPanning: vi.fn(),
        updatePanning: vi.fn(),
        stopPanning: vi.fn(() => { STATE.ui.view.isPanning = false; }),
        handleZoom: vi.fn()
    }
}));

vi.mock('../core/dom.js', () => ({
    DOM: {
        canvas: { style: {} },
        boolMenu: { classList: { contains: () => true, remove: vi.fn(), add: vi.fn() }, style: {} },
        propPanel: { classList: { add: vi.fn() } },
        btnApply: { addEventListener: vi.fn() },
        btnReset: { addEventListener: vi.fn() },
        btnModeDraw: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnModeSelect: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnView2D: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnView3D: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnResetCam: { addEventListener: vi.fn() },
        btnToolSlice: { addEventListener: vi.fn() },
        input: { addEventListener: vi.fn() },
        propName: { addEventListener: vi.fn() },
        propThickness: { addEventListener: vi.fn() },
        propJson: { addEventListener: vi.fn() },
        propDelete: { addEventListener: vi.fn() },
        btnAddCutout: { addEventListener: vi.fn() },
        btnAddTenon: { addEventListener: vi.fn() },
        btnBoolUnion: { addEventListener: vi.fn() },
        btnBoolSubtract: { addEventListener: vi.fn() },
        btnBoolCancel: { addEventListener: vi.fn() },
        btnAddProject: { addEventListener: vi.fn() },
        facePrevBtn: { addEventListener: vi.fn() },
        faceNextBtn: { addEventListener: vi.fn() },
        canvas3D: { addEventListener: vi.fn() },
        controls2D: { classList: { toggle: vi.fn() } },
        controls3D: { classList: { toggle: vi.fn() } },
    }
}));

vi.mock('../operations/threed-op.js', () => ({ ThreedOp: { handleMouseMove: vi.fn() } }));
vi.mock('../systems/dom-renderer.js', () => ({ DOMRenderer: { updatePropertiesPanel: vi.fn() } }));
vi.mock('../utils/boolean-ops.js', () => ({
    BooleanOps: {
        checkIntersection: vi.fn(),
        union: vi.fn(),
        subtract: vi.fn()
    }
}));

vi.mock('../operations/drawing-op.js', () => ({
    DrawingOp: {
        handleDrawClick: vi.fn(),
        updatePreview: vi.fn(),
        cancel: vi.fn()
    }
}));

describe('Input System - Panning vs Click', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        STATE.ui.mode = 'SELECT';
        STATE.ui.isSpacePressed = false;
        STATE.ui.dragging = { type: null };
        STATE.ui.view.isPanning = false;
        STATE.ui.view.zoom = 1;
        STATE.ui.view.pan = { x: 0, y: 0 };
    });

    it('should NOT trigger selection (click) after a pan operation', () => {
        // 1. Setup: User holds Spacebar to pan
        STATE.ui.isSpacePressed = true;

        // 2. Mouse Down (Start Pan)
        Input.handleMouseDown({ button: 0, clientX: 100, clientY: 100 });
        expect(ViewportOp.startPanning).toHaveBeenCalled();
        
        // Manually set panning state (usually ViewportOp does this)
        STATE.ui.view.isPanning = true;

        // 3. Mouse Move (Panning)
        Input.handleMouseMove({ clientX: 150, clientY: 150 });
        expect(ViewportOp.updatePanning).toHaveBeenCalled();

        // 4. Mouse Up (End Pan)
        Input.handleMouseUp({ clientX: 150, clientY: 150 });
        expect(ViewportOp.stopPanning).toHaveBeenCalled();

        // 5. Click Event (Fired by browser immediately after MouseUp)
        Input.handleCanvasClick({ button: 0, clientX: 150, clientY: 150, ctrlKey: false });

        // Expectation: Selection should NOT happen because we were panning.
        expect(SelectionOp.handleSelect).not.toHaveBeenCalled();
    });

        it('should ALLOW drawing again after a pan operation is finished', () => {

            // ... (existing test code) ...

        });

    

            it('should restore drawing preview after releasing Space key while mouse is down', () => {

    

                // ... (existing test code) ...

    

            });

    

        

    

                it('should NOT stay blocked if a click event is missed or delayed', async () => {

    

        

    

                    // ... (existing test code) ...

    

        

    

                });

    

        

    

            

    

        

    

                    it('should ALLOW drawing even if Space is still held after a pan', () => {

    

        

    

            

    

        

    

                        // ... (existing test code) ...

    

        

    

            

    

        

    

                    });

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    

                    it('should suppress click even if Space is released BEFORE MouseUp', () => {

    

        

    

            

    

        

    

                        STATE.ui.mode = 'DRAW';

    

        

    

            

    

        

    

                        

    

        

    

            

    

        

    

                        // 1. Space Down + Mouse Down

    

        

    

            

    

        

    

                        STATE.ui.isSpacePressed = true;

    

        

    

            

    

        

    

                        Input.handleMouseDown({ button: 0, clientX: 100, clientY: 100 });

    

        

    

            

    

        

    

                        expect(Input.isPanningInteraction).toBe(true);

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    

                        // 2. Mouse Move (Pan)

    

        

    

            

    

        

    

                        Input.handleMouseMove({ clientX: 150, clientY: 150 });

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    

                        // 3. Space Up (Release space early)

    

        

    

            

    

        

    

                        Input.handleKeyUp({ key: ' ' });

    

        

    

            

    

        

    

                        expect(STATE.ui.isSpacePressed).toBe(false);

    

        

    

            

    

        

    

                        expect(STATE.ui.view.isPanning).toBe(false);

    

        

    

            

    

        

    

                        // BUT interaction should still be marked as panning!

    

        

    

            

    

        

    

                        expect(Input.isPanningInteraction).toBe(true);

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    

                        // 4. Mouse Up

    

        

    

            

    

        

    

                        Input.handleMouseUp({ clientX: 150, clientY: 150 });

    

        

    

            

    

        

    

                        expect(Input.ignoreNextClick).toBe(true);

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    

                        // 5. Click should be suppressed

    

        

    

            

    

        

    

                        Input.handleCanvasClick({ button: 0, clientX: 150, clientY: 150 });

    

        

    

            

    

        

    

                        expect(DrawingOp.handleDrawClick).not.toHaveBeenCalled();

    

        

    

            

    

        

    

                    });

    

        

    

            

    

        

    

                });

    

        

    

            

    

        

    

                

    

        

    

            

    

        

    