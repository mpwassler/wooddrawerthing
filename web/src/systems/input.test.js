/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input } from './input.js';
import { STATE } from '../core/state.js';
import { SelectionOp } from '../operations/selection-op.js';
import { ViewportOp } from '../operations/viewport-op.js';
import { DrawingOp } from '../operations/drawing-op.js';
import { Store } from '../core/store.js';
import { DOM } from '../core/dom.js';

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

vi.mock('../core/store.js', () => ({
    Store: {
        dispatch: vi.fn(),
        undo: vi.fn(),
        init: vi.fn()
    }
}));

vi.mock('../core/dom.js', () => ({
    DOM: {
        canvas: { style: {}, addEventListener: vi.fn() },
        boolMenu: { classList: { contains: () => true, remove: vi.fn(), add: vi.fn() }, style: {} },
        boardPresetMenu: { classList: { contains: () => true, remove: vi.fn(), add: vi.fn() }, style: {} },
        presetButtons: [],
        btnClosePresetMenu: { addEventListener: vi.fn() },
        propPanel: { classList: { add: vi.fn() } },
        btnModeDraw: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnModeSelect: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnModePull: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnView2D: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnView3D: { addEventListener: vi.fn(), classList: { toggle: vi.fn() } },
        btnResetCam: { addEventListener: vi.fn() },
        btnToolSlice: { addEventListener: vi.fn() },
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

describe('Input System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        STATE.ui.mode = 'SELECT';
        STATE.ui.isSpacePressed = false;
        STATE.ui.dragging = { type: null };
        STATE.ui.view.isPanning = false;
        STATE.ui.view.zoom = 1;
        STATE.ui.view.pan = { x: 0, y: 0 };
        STATE.ui.view.panStart = { x: 0, y: 0 };
        STATE.document.projects = [{ id: 'p1', shapes: [] }];
        STATE.document.currentProjectId = 'p1';
    });

    describe('Panning Logic', () => {
        it('should NOT trigger selection (click) after a total pan movement > tolerance', () => {
            STATE.ui.isSpacePressed = true;
            Input.handleMouseDown({ clientX: 100, clientY: 100 });
            
            STATE.ui.view.isPanning = true;
            Input.isPanningInteraction = true;
            Input.mouseDownPos = { x: 100, y: 100 };

            // Simulate move
            Input.handleMouseMove({ clientX: 150, clientY: 150 });

            // Mouse Up
            Input.handleMouseUp({ clientX: 150, clientY: 150 });
            expect(Input.ignoreNextClick).toBe(true);

            // Click event should be ignored
            Input.handleCanvasClick({ button: 0, clientX: 150, clientY: 150 });
            expect(SelectionOp.handleSelect).not.toHaveBeenCalled();
        });

        it('should ALLOW drawing again after a pan operation is finished', () => {
            STATE.ui.mode = 'DRAW';
            STATE.ui.isSpacePressed = true;
            Input.handleMouseDown({ clientX: 100, clientY: 100 });
            STATE.ui.view.isPanning = true; 
            Input.isPanningInteraction = true;
            Input.mouseDownPos = { x: 100, y: 100 };

            Input.handleMouseUp({ clientX: 150, clientY: 150 });
            expect(Input.ignoreNextClick).toBe(true);

            // First Click (should be ignored)
            Input.handleCanvasClick({ button: 0, clientX: 150, clientY: 150 });
            expect(DrawingOp.handleDrawClick).not.toHaveBeenCalled();

            // Second Click (should work!)
            Input.handleCanvasClick({ button: 0, clientX: 160, clientY: 160 });
            expect(DrawingOp.handleDrawClick).toHaveBeenCalled();
        });

        it('should suppress click even if Space is released BEFORE MouseUp', () => {
            STATE.ui.mode = 'DRAW';
            STATE.ui.isSpacePressed = true;
            Input.handleMouseDown({ button: 0, clientX: 100, clientY: 100 });
            expect(Input.isPanningInteraction).toBe(true);

            Input.handleMouseMove({ clientX: 150, clientY: 150 });

            // Release space early
            Input.handleKeyUp({ key: ' ' });
            expect(STATE.ui.isSpacePressed).toBe(false);
            expect(Input.isPanningInteraction).toBe(true);

            Input.handleMouseUp({ clientX: 150, clientY: 150 });
            expect(Input.ignoreNextClick).toBe(true);

            Input.handleCanvasClick({ button: 0, clientX: 150, clientY: 150 });
            expect(DrawingOp.handleDrawClick).not.toHaveBeenCalled();
        });
    });

    describe('Board Presets', () => {
        it('should show the preset menu on handleContextMenu', () => {
            const mockEvent = {
                preventDefault: vi.fn(),
                clientX: 300,
                clientY: 200
            };
            
            // Setup some view state
            STATE.ui.view.zoom = 1;
            STATE.ui.view.pan = { x: 0, y: 0 };

            Input.handleContextMenu(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(DOM.boardPresetMenu.classList.remove).toHaveBeenCalledWith('hidden');
            // Check world position storage (screen 300,200 -> world 300,200 with zoom 1 pan 0)
            expect(Input.lastContextMenuWorld).toEqual({ x: 300, y: 200 });
        });

        it('should dispatch SHAPE_ADD with correct dimensions for a 2x4 preset', () => {
            Input.lastContextMenuWorld = { x: 100, y: 100 };
            const mockBtn = {
                dataset: { w: "3.5", t: "1.5" },
                innerText: "2x4 Stud (8')"
            };
            const mockEvent = { currentTarget: mockBtn };

            Input.handleAddPreset(mockEvent);

            expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_ADD', expect.objectContaining({
                document: expect.objectContaining({
                    shapes: expect.arrayContaining([
                        expect.objectContaining({
                            name: "2x4 Stud",
                            thickness: 1.5,
                            points: [
                                { x: 100, y: 100, lengthToNext: 3.5 },
                                { x: 135, y: 100, lengthToNext: 96 }, // 100 + (3.5 * 10)
                                { x: 135, y: 1060, lengthToNext: 3.5 }, // 100 + (96 * 10)
                                { x: 100, y: 1060, lengthToNext: 96 }
                            ]
                        })
                    ])
                })
            }), true);
        });
    });

    describe('Pull Mode', () => {
        it('should track the hovered edge while in pull mode', () => {
            STATE.ui.mode = 'PULL';
            const shape = {
                id: 'shape-1',
                closed: true,
                points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 50 },
                    { x: 0, y: 50 }
                ]
            };
            STATE.document.projects = [{ id: 'p1', shapes: [shape] }];
            STATE.document.currentProjectId = 'p1';
            STATE.ui.selectedShapeId = 'shape-1';
            STATE.ui.view.zoom = 1;
            STATE.ui.view.pan = { x: 0, y: 0 };

            Input.handleMouseMove({ clientX: 50, clientY: 3 });

            expect(STATE.ui.hoveredEdgeShapeId).toBe('shape-1');
            expect(STATE.ui.hoveredEdgeIndex).toBe(0);
        });
    });
});
