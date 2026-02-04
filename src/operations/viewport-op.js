/**
 * @fileoverview Viewport Operations
 * Handles panning and zooming logic.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';
import { Store } from '../core/store.js';

export const ViewportOp = {
    startPanning: (e) => {
        Store.dispatch('VIEW_PAN_START', {
            ui: { 
                view: { 
                    ...STATE.ui.view,
                    isPanning: true,
                    panStart: { x: e.clientX, y: e.clientY }
                }
            }
        });
    },

    updatePanning: (e) => {
        if (!STATE.ui.view.isPanning) return;
        const dx = e.clientX - STATE.ui.view.panStart.x;
        const dy = e.clientY - STATE.ui.view.panStart.y;
        
        Store.dispatch('VIEW_PAN', {
            ui: { 
                view: { 
                    ...STATE.ui.view,
                    pan: { 
                        x: STATE.ui.view.pan.x + dx, 
                        y: STATE.ui.view.pan.y + dy 
                    },
                    panStart: { x: e.clientX, y: e.clientY }
                } 
            }
        });
    },

    stopPanning: () => {
        Store.dispatch('VIEW_PAN_STOP', {
            ui: { 
                view: { 
                    ...STATE.ui.view,
                    isPanning: false
                }
            }
        });
    },

    handleZoom: (e) => {
        e.preventDefault();
        const { view } = STATE.ui;
        const mouse = { x: e.clientX, y: e.clientY };
        const worldBefore = Geometry.screenToWorld(mouse, view);
        
        const factor = e.deltaY * -CONFIG.ZOOM.SENSITIVITY;
        const newZoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, view.zoom * Math.exp(factor)));
        
        const newPanX = view.pan.x + (worldBefore.x * newZoom + view.pan.x - mouse.x - (worldBefore.x * view.zoom + view.pan.x - mouse.x));
        // Simplified math: WorldToScreen(worldBefore) with new zoom, then finding delta?
        // Let's stick to the previous logic but apply it to the new object.
        // Previous: view.pan.x += (worldAfter.x - worldBefore.x) * view.zoom;
        // Wait, 'worldAfter' depends on the *new* pan? No, worldAfter is where the mouse IS in world coords.
        // The goal is to keep the mouse pointing at the same world coordinate.
        
        // Correct Zoom-to-Point math:
        // World = (Screen - Pan) / Zoom
        // Screen = World * Zoom + Pan
        // We want Screen (mouse) to match World (worldBefore) with NewZoom and NewPan.
        // mouse.x = worldBefore.x * newZoom + newPan.x
        // newPan.x = mouse.x - worldBefore.x * newZoom
        
        const newPan = {
            x: mouse.x - worldBefore.x * newZoom,
            y: mouse.y - worldBefore.y * newZoom
        };

        Store.dispatch('VIEW_ZOOM', {
            ui: {
                view: {
                    ...view,
                    zoom: newZoom,
                    pan: newPan
                }
            }
        });
    }
};
