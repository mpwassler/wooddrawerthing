/**
 * @fileoverview Main Application Entry Point
 * Orchestrates initialization and the main loop.
 */

import { STATE } from './core/state.js';
import { DOM } from './core/dom.js';
import { Input } from './systems/input.js';
import { ViewController } from './systems/view-controller.js';
import { CanvasRenderer } from './renderers/canvas-renderer.js';
import { WebGLRenderer } from './renderers/webgl-renderer.js';

function init() {
    // 1. Initialize Renderers
    STATE.renderer = new WebGLRenderer(DOM.canvas);
    STATE.renderer.setMode('2D'); 
    
    STATE.renderer3D = new WebGLRenderer(DOM.canvas3D);
    STATE.renderer3D.setMode('3D'); 
    
    STATE.overlay = new CanvasRenderer(DOM.overlay);
    
    // 2. Initial Layout
    const w = window.innerWidth;
    const h = window.innerHeight;
    STATE.renderer.resize(w, h);
    STATE.overlay.resize(w, h);
    STATE.renderer3D.resize(w * 0.9, h * 0.9); 
    
    STATE.ui.view.pan = { x: w / 2, y: h / 2 };

    // 3. Bind Event Listeners
    DOM.canvas.addEventListener('click', Input.handleCanvasClick);
    DOM.canvas.addEventListener('mousedown', Input.handleMouseDown);
    DOM.canvas.addEventListener('wheel', Input.handleWheel);
    
    window.addEventListener('mousemove', Input.handleMouseMove);
    window.addEventListener('mouseup', Input.handleMouseUp);
    window.addEventListener('resize', () => {
        const ww = window.innerWidth;
        const hh = window.innerHeight;
        STATE.renderer.resize(ww, hh);
        STATE.overlay.resize(ww, hh);
        if (STATE.ui.is3DOpen) {
             const rect = DOM.canvas3D.getBoundingClientRect();
             STATE.renderer3D.resize(rect.width, rect.height);
        }
    });
    
    DOM.btnApply.addEventListener('click', Input.handleInputApply);
    DOM.btnReset.addEventListener('click', Input.handleReset);
    DOM.btnModeDraw.addEventListener('click', () => Input.switchMode('DRAW'));
    DOM.btnModeSelect.addEventListener('click', () => Input.switchMode('SELECT'));
    
    DOM.btnView3D.addEventListener('click', Input.open3DMode);
    DOM.btnClose3D.addEventListener('click', Input.close3DMode);
    
    // Properties Panel
    DOM.propName.addEventListener('input', Input.handlePropChange);
    DOM.propThickness.addEventListener('mousedown', Input.handleThicknessMouseDown);
    DOM.propJson.addEventListener('change', Input.handleJSONImport);
    DOM.propDelete.addEventListener('click', Input.handleDeleteShape);
    DOM.btnAddCutout.addEventListener('click', Input.handleAddCutout);
    DOM.btnAddTenon.addEventListener('click', Input.handleAddTenon);
    
    DOM.btnBoolUnion.addEventListener('click', Input.handleBooleanUnion);
    DOM.btnBoolSubtract.addEventListener('click', Input.handleBooleanSubtract);
    DOM.btnBoolCancel.addEventListener('click', Input.hideBooleanMenu);
    
    // 4. Start Main Loop
    loop();
}

function loop() {
    ViewController.render();
    
    if (STATE.renderer && STATE.renderer.render) {
        STATE.renderer.render();
    }
    
    if (STATE.ui.is3DOpen && STATE.renderer3D && STATE.renderer3D.render) {
        STATE.renderer3D.render();
    }
    
    requestAnimationFrame(loop);
}

init();