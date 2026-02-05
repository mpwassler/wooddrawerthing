/**
 * @fileoverview Main Application Entry Point
 * Orchestrates initialization and the main loop.
 */

import { STATE } from './core/state.js';
import { DOM } from './core/dom.js';
import { Store } from './core/store.js';
import { Input } from './systems/input.js';
import { ThreedOp } from './operations/threed-op.js';
import { ProjectOp } from './operations/project-op.js';
import { ViewController } from './systems/view-controller.js';
import { CanvasRenderer } from './renderers/canvas-renderer.js';
import { WebGLRenderer } from './renderers/webgl-renderer.js';

async function init() {
    // 0. Initialize Store
    Store.init();

    // 1. Initialize Renderers
    STATE.renderer = new WebGLRenderer(DOM.canvas);
    STATE.renderer.setMode('2D'); 
    
    STATE.renderer3D = new WebGLRenderer(DOM.canvas3D);
    STATE.renderer3D.setMode('3D'); 
    
    // Wire up 3D assembly persistence
    STATE.renderer3D.transformControls.addEventListener('change', () => {
        ThreedOp.persistTransforms();
    });
    
    STATE.overlay = new CanvasRenderer(DOM.overlay);

    // 2. Initialize Storage & Projects (Non-blocking)
    ProjectOp.init().catch(err => console.error("Failed to load projects:", err));
    
    // 3. Initial Layout
    const w = DOM.canvas.parentElement.clientWidth;
    const h = DOM.canvas.parentElement.clientHeight;
    STATE.renderer.resize(w, h);
    STATE.overlay.resize(w, h);
    STATE.renderer3D.resize(w * 0.9, h * 0.9); 
    
    STATE.ui.view.pan = { x: w / 2, y: h / 2 };

    // 4. Bind Event Listeners
    DOM.canvas.addEventListener('click', Input.handleCanvasClick);
    DOM.canvas.addEventListener('mousedown', Input.handleMouseDown);
    DOM.canvas.addEventListener('wheel', Input.handleWheel);
    DOM.canvas.addEventListener('contextmenu', Input.handleContextMenu);

    // Context Menu Buttons
    DOM.presetButtons.forEach(btn => {
        btn.addEventListener('click', Input.handleAddPreset);
    });
    DOM.btnClosePresetMenu.addEventListener('click', Input.hidePresetMenu);

    // 3D Specific events
    DOM.canvas3D.addEventListener('mousedown', ThreedOp.handleMouseDown);
    window.addEventListener('keydown', (e) => {
        if (STATE.ui.is3DOpen) {
            ThreedOp.handleKeyDown(e);
        }
        Input.handleKeyDown(e);
    });
    window.addEventListener('keyup', Input.handleKeyUp);
    window.addEventListener('blur', () => {
        STATE.ui.isSpacePressed = false;
        if (STATE.ui.view.isPanning) {
            Input.handleMouseUp({ clientX: 0, clientY: 0 }); // Force stop
        }
    });
    
    let throttleTimeout = null;
    window.addEventListener('mousemove', (e) => {
        if (throttleTimeout) return;
        throttleTimeout = setTimeout(() => {
            Input.handleMouseMove(e);
            throttleTimeout = null;
        }, 32); 
    });
    
    window.addEventListener('mouseup', Input.handleMouseUp);
    window.addEventListener('resize', () => {
        const ww = DOM.canvas.parentElement.clientWidth;
        const hh = DOM.canvas.parentElement.clientHeight;
        STATE.renderer.resize(ww, hh);
        STATE.overlay.resize(ww, hh);
        if (STATE.ui.is3DOpen) {
             const rect = DOM.canvas3D.getBoundingClientRect();
             STATE.renderer3D.resize(rect.width, rect.height);
        }
    });
    
    // Event Listeners
    DOM.btnModeDraw.addEventListener('click', () => Input.switchTool('DRAW'));
    DOM.btnModeSelect.addEventListener('click', () => Input.switchTool('SELECT'));
    
    DOM.btnView2D.addEventListener('click', () => Input.switchView('2D'));
    DOM.btnView3D.addEventListener('click', () => Input.switchView('3D'));
    
    // 3D Tools
    // DOM.btnResetCam.addEventListener('click', () => {
    //     if (STATE.renderer3D) STATE.renderer3D.render3DScene(STATE.document.shapes, true);
    // });
    
    DOM.btnToolSlice.addEventListener('click', () => {
        const isActive = DOM.btnToolSlice.classList.toggle('active');
        Store.dispatch('TOOL_3D_SELECT', {
            ui: { activeTool3D: isActive ? 'SLICE' : 'SELECT' }
        });
        // Clear selection if switching tools
        if (isActive && STATE.ui.selectedAssemblyId) {
            Store.dispatch('DESELECT_3D', { ui: { selectedAssemblyId: null, selectedShapeId: null } });
            if (STATE.renderer3D && STATE.renderer3D.transformControls) STATE.renderer3D.transformControls.detach();
        }
    });
    
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

    // Project Management
    DOM.btnAddProject.addEventListener('click', () => {
        const name = prompt("Project Name:");
        if (name) ProjectOp.createNewProject(name);
    });

    // Face Navigation
    DOM.facePrevBtn.addEventListener('click', () => Input.cycleFace(-1));
    DOM.faceNextBtn.addEventListener('click', () => Input.cycleFace(1));
    
    // 5. Start Main Loop
    loop();
}

let lastSaveTime = 0;
const SAVE_INTERVAL = 2000; // Auto-save every 2 seconds if changed

let lastLogTime = 0;

function loop() {
    const now = Date.now();
    if (now - lastLogTime > 1000) {
        // console.log("Loop Active. Shapes:", STATE.document.shapes.length);
        lastLogTime = now;
    }

    ViewController.render();
    
    if (STATE.renderer && STATE.renderer.render) {
        STATE.renderer.render();
    }
    
    if (STATE.ui.is3DOpen && STATE.renderer3D && STATE.renderer3D.render) {
        STATE.renderer3D.render();
    }

    // Auto-save logic
    if (now - lastSaveTime > SAVE_INTERVAL) {
        ProjectOp.saveCurrentProject();
        lastSaveTime = now;
    }
    
    requestAnimationFrame(loop);
}

init();