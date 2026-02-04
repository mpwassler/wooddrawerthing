import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawingOp } from './drawing-op.js';
import { STATE } from '../core/state.js';
import { Store } from '../core/store.js';
import { CONFIG } from '../core/config.js';

// Mock Store
vi.mock('../core/store.js', () => ({
    Store: {
        dispatch: vi.fn()
    }
}));

describe('DrawingOp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset State to defaults suitable for drawing
        STATE.ui = {
            drawState: 'IDLE',
            activeDrawing: {
                points: [],
                tempLine: null,
                selectedDirection: null,
                highlightedDirection: null,
                snapTarget: null,
                alignmentGuide: null
            },
            view: { zoom: 1, pan: { x: 0, y: 0 } }
        };
        STATE.document = { shapes: [] };
    });

    describe('handleDrawClick', () => {
        it('starts a new shape when IDLE', () => {
            STATE.ui.drawState = 'IDLE';
            const mouse = { x: 10, y: 10 };
            
            DrawingOp.handleDrawClick(mouse, mouse);
            
            expect(Store.dispatch).toHaveBeenCalledWith('DRAW_START', expect.objectContaining({
                ui: expect.objectContaining({
                    drawState: 'START_SHAPE',
                    activeDrawing: expect.objectContaining({
                        points: [mouse]
                    })
                })
            }));
        });

        it('sets direction when START_SHAPE and direction is highlighted', () => {
            STATE.ui.drawState = 'START_SHAPE';
            STATE.ui.activeDrawing.points = [{ x: 0, y: 0 }];
            STATE.ui.activeDrawing.highlightedDirection = { x: 1, y: 0 }; // Right
            
            DrawingOp.handleDrawClick({ x: 0, y: 0 }, { x: 0, y: 0 });

            expect(Store.dispatch).toHaveBeenCalledWith('DRAW_DIRECTION_SET', expect.objectContaining({
                ui: expect.objectContaining({
                    drawState: 'DRAWING_LINE',
                    activeDrawing: expect.objectContaining({
                        selectedDirection: { x: 1, y: 0 },
                        highlightedDirection: null
                    })
                })
            }));
        });

        it('restarts shape (resets) when START_SHAPE but no direction highlighted', () => {
            STATE.ui.drawState = 'START_SHAPE';
            STATE.ui.activeDrawing.points = [{ x: 0, y: 0 }];
            STATE.ui.activeDrawing.highlightedDirection = null;

            const newMouse = { x: 50, y: 50 };
            DrawingOp.handleDrawClick(newMouse, newMouse);

            // It actually dispatches two events in the current implementation: RESET then START
            expect(Store.dispatch).toHaveBeenCalledTimes(2);
            expect(Store.dispatch).toHaveBeenNthCalledWith(1, 'DRAW_RESET', expect.anything());
            expect(Store.dispatch).toHaveBeenNthCalledWith(2, 'DRAW_START', expect.objectContaining({
                ui: expect.objectContaining({
                    drawState: 'START_SHAPE',
                    activeDrawing: expect.objectContaining({
                        points: [newMouse]
                    })
                })
            }));
        });

        it('adds a point when DRAWING_LINE', () => {
            STATE.ui.drawState = 'DRAWING_LINE';
            STATE.ui.activeDrawing.points = [{ x: 0, y: 0 }];
            STATE.ui.activeDrawing.tempLine = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
            STATE.ui.activeDrawing.selectedDirection = { x: 1, y: 0 };
            
            DrawingOp.handleDrawClick({ x: 10, y: 0 }, { x: 10, y: 0 });

            expect(Store.dispatch).toHaveBeenCalledWith('DRAW_POINT_ADDED', expect.objectContaining({
                ui: expect.objectContaining({
                    drawState: 'START_SHAPE',
                    activeDrawing: expect.objectContaining({
                        points: [{ x: 0, y: 0, lengthToNext: 1 }, { x: 10, y: 0 }]
                    })
                })
            }));
        });

        it('completes shape when DRAWING_LINE and snapTarget exists', () => {
            STATE.ui.drawState = 'DRAWING_LINE';
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 10, y: 0 };
            const p3 = { x: 10, y: 10 }; // Target closing back to p1
            
            STATE.ui.activeDrawing.points = [p1, p2, p3];
            STATE.ui.activeDrawing.tempLine = { start: p3, end: p1 };
            STATE.ui.activeDrawing.snapTarget = p1; // Closing the loop
            STATE.ui.activeDrawing.selectedDirection = { x: -1, y: 0 }; // Going left back to 0

            DrawingOp.handleDrawClick({ x: 0, y: 10 }, { x: 0, y: 10 });

            expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_ADD', expect.objectContaining({
                document: expect.anything(), // Could verify shape structure
                ui: expect.objectContaining({
                    drawState: 'IDLE',
                    mode: 'SELECT'
                })
            }));
        });
    });

    describe('updatePreview', () => {
        it('calculates highlighted direction in START_SHAPE', () => {
            STATE.ui.drawState = 'START_SHAPE';
            STATE.ui.activeDrawing.points = [{ x: 100, y: 100 }]; // Screen coords roughly same if world is 100,100
            
            // Mouse to the Right (Direction {1, 0})
            // Grid radius is 40. Mouse at 140, 100 should highlight Right.
            const mouseScreen = { x: 140, y: 100 }; 
            const mouseWorld = { x: 140, y: 100 }; // Zoom 1, Pan 0

            DrawingOp.updatePreview(mouseWorld, mouseScreen);

            expect(STATE.ui.activeDrawing.highlightedDirection).toEqual(
                expect.objectContaining({ x: 1, y: 0 })
            );
        });

        it('snaps to increments in DRAWING_LINE', () => {
            STATE.ui.drawState = 'DRAWING_LINE';
            const start = { x: 0, y: 0 };
            STATE.ui.activeDrawing.points = [start];
            STATE.ui.activeDrawing.selectedDirection = { x: 1, y: 0 }; // Right
            
            // Mouse at 102 pixels. Scale is 10px/inch.
            // 102px = 10.2 inches.
            // Should snap to 10.0 inches (whole inch tier) or 10.25 (quarter)?
            // 10.2 is 0.2 away from 10.0 (20px). Snap radius is 15px.
            // 10.2 is 0.05 away from 10.25 (5px).
            // Logic prioritizes larger increments if within threshold.
            // Let's test a clear case. 
            // 100.5px = 10.05 inches. 
            // Dist from 10.0 is 0.05in (0.5px). Should snap to 10.0.
            
            const mouseWorld = { x: 100.5, y: 0 };
            const mouseScreen = { x: 100.5, y: 0 };

            DrawingOp.updatePreview(mouseWorld, mouseScreen);

            const expectedLen = 10.0 * CONFIG.SCALE_PIXELS_PER_INCH; // 100
            expect(STATE.ui.activeDrawing.tempLine.end.x).toBeCloseTo(expectedLen);
        });
    });
});
