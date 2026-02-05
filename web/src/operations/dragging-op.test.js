/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraggingOp } from './dragging-op.js';
import { STATE } from '../core/state.js';
import { Store } from '../core/store.js';

// Mock DOM elements
vi.mock('../core/dom.js', () => ({
    DOM: {
        canvas: { style: {} },
        boolMenu: { classList: { contains: () => true, add: vi.fn(), remove: vi.fn() } }
    }
}));

vi.mock('../systems/input.js', () => ({
    Input: {
        activeFaceData: vi.fn()
    }
}));

vi.mock('../operations/threed-op.js', () => ({
    ThreedOp: {}
}));

// Mock Store
vi.mock('../core/store.js', () => ({
    Store: {
        dispatch: vi.fn()
    }
}));

describe('DraggingOp', () => {
    let mockShape;

    beforeEach(() => {
        vi.clearAllMocks();
        mockShape = {
            id: 'shape-1',
            points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
            thickness: 1,
            faceData: { FRONT: { tenons: [], cutouts: [] } }
        };
        
        STATE.document = { shapes: [mockShape] };
        STATE.ui = {
            dragging: {
                type: 'SHAPE',
                item: mockShape,
                lastPos: { x: 0, y: 0 },
                isCloneMode: false // Default
            },
            view: { zoom: 1, pan: { x: 0, y: 0 } }
        };
    });

    it('moves a shape normally when NOT in clone mode', () => {
        // Move mouse to (5, 5)
        const mouseWorld = { x: 5, y: 5 };
        const mouseScreen = { x: 50, y: 50 };

        DraggingOp.update(mouseWorld, mouseScreen);

        expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_DRAG_MOVE', expect.objectContaining({
            document: expect.objectContaining({
                shapes: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'shape-1',
                        points: expect.arrayContaining([{ x: 5, y: 5, lengthToNext: undefined }]) // roughly
                    })
                ])
            })
        }));
        // Should NOT dispatch SHAPE_ADD
        expect(Store.dispatch).not.toHaveBeenCalledWith('SHAPE_ADD', expect.anything(), expect.anything());
    });

    it('CLONES a shape when in clone mode (2D Copy)', () => {
        // Setup Clone Mode
        STATE.ui.dragging.isCloneMode = true;

        // Move mouse to (5, 5)
        const mouseWorld = { x: 5, y: 5 };
        const mouseScreen = { x: 50, y: 50 };

        DraggingOp.update(mouseWorld, mouseScreen);

        // Expectation:
        // 1. SHAPE_ADD should be dispatched to create the copy.
        // 2. The copy should be placed at the new position (or original, then moved? Implementation detail).
        // 3. IMPORTANT: The dragging session should transfer to the NEW shape so subsequent moves affect the copy.
        // 4. isCloneMode should be turned off immediately so we don't spawn copies on every pixel.

        expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_ADD', expect.objectContaining({
            // We expect the document to contain the NEW shape (clone)
            document: { 
                shapes: expect.arrayContaining([
                    mockShape, // Original
                    expect.objectContaining({ 
                        name: expect.stringMatching(/Copy/), // Optional convention
                        // Points should be shifted by delta (5, 5)
                        points: expect.arrayContaining([{ x: 5, y: 5, lengthToNext: undefined }]) 
                    }) 
                ]) 
            },
            ui: expect.objectContaining({
                dragging: expect.objectContaining({
                    // The drag item must be updated to the NEW shape
                    item: expect.not.objectContaining({ id: 'shape-1' }),
                    // Clone mode must be consumed
                    isCloneMode: false
                })
            })
        }), true); // Persistence should be true for the Add action
    });

    it('moves the active edge along its normal in pull mode', () => {
        STATE.ui.dragging = {
            type: 'EDGE',
            item: mockShape,
            edgeIndex: 0,
            lastPos: { x: 0, y: 0 }
        };

        const mouseWorld = { x: 0, y: 5 };
        const mouseScreen = { x: 0, y: 50 };

        DraggingOp.update(mouseWorld, mouseScreen);

        expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_EDGE_DRAG', expect.objectContaining({
            document: expect.objectContaining({
                shapes: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'shape-1',
                        points: expect.arrayContaining([
                            expect.objectContaining({ x: 0, y: 5 }),
                            expect.objectContaining({ x: 10, y: 5 })
                        ])
                    })
                ])
            })
        }));
    });
});
