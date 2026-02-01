/**
 * @fileoverview Viewport Operations
 * Handles panning and zooming logic.
 */

import { STATE } from '../core/state.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';

export const ViewportOp = {
    startPanning: (e) => {
        STATE.ui.view.isPanning = true;
        STATE.ui.view.panStart = { x: e.clientX, y: e.clientY };
    },

    updatePanning: (e) => {
        if (!STATE.ui.view.isPanning) return;
        const dx = e.clientX - STATE.ui.view.panStart.x;
        const dy = e.clientY - STATE.ui.view.panStart.y;
        STATE.ui.view.pan.x += dx;
        STATE.ui.view.pan.y += dy;
        STATE.ui.view.panStart = { x: e.clientX, y: e.clientY };
    },

    stopPanning: () => {
        STATE.ui.view.isPanning = false;
    },

    handleZoom: (e) => {
        e.preventDefault();
        const { view } = STATE.ui;
        const mouse = { x: e.clientX, y: e.clientY };
        const worldBefore = Geometry.screenToWorld(mouse, view);
        
        const factor = e.deltaY * -CONFIG.ZOOM.SENSITIVITY;
        const newZoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, view.zoom * Math.exp(factor)));
        
        view.zoom = newZoom;
        const worldAfter = Geometry.screenToWorld(mouse, view);
        
        view.pan.x += (worldAfter.x - worldBefore.x) * view.zoom;
        view.pan.y += (worldAfter.y - worldBefore.y) * view.zoom;
    }
};
