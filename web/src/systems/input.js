/**
 * @fileoverview Input System
 * Routes low-level events to specialized Operations.
 */

import { STATE } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Geometry } from '../utils/geometry.js';
import { BooleanOps } from '../utils/boolean-ops.js';
import { CONFIG } from '../core/config.js';
import { ViewportOp } from '../operations/viewport-op.js';
import { SelectionOp } from '../operations/selection-op.js';
import { DrawingOp } from '../operations/drawing-op.js';
import { DraggingOp } from '../operations/dragging-op.js';
import { JoineryOp } from '../operations/joinery-op.js';
import { DocumentOp } from '../operations/document-op.js';
import { ProjectOp } from '../operations/project-op.js';
import { ShapeModel } from '../core/model.js';
import { DOMRenderer } from './dom-renderer.js';
import { ThreedOp } from '../operations/threed-op.js';
import { Store } from '../core/store.js';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const Input = {
    // --- Helpers ---
    // activeFaceData moved to DOMRenderer/internal use, or we export a helper in Geometry/State?
    // Let's keep a simple getter here if needed for Dragging, or import from DOMRenderer?
    // Actually DraggingOp uses it too. Let's move 'activeFaceData' to STATE or Geometry helper? 
    // For now, let's duplicate the getter or keep it here and export it.
    activeFaceData: () => {
        const shape = STATE.selectedShape;
        if (!shape || !shape.faceData) return { tenons: [], cutouts: [] };
        return shape.faceData[shape.activeFace || 'FRONT'] || { tenons: [], cutouts: [] };
    },
    findEdgeHit: (shape, mouseWorld, toleranceWorld) => {
        if (!shape || !shape.closed || shape.points.length < 2) return null;
        let bestIdx = null;
        let bestDist = Infinity;
        for (let i = 0; i < shape.points.length; i++) {
            const p1 = shape.points[i];
            const p2 = shape.points[(i + 1) % shape.points.length];
            const closest = Geometry.closestPointOnSegment(mouseWorld, p1, p2);
            const dist = Geometry.dist(mouseWorld, closest);
            if (dist < toleranceWorld && dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        return bestIdx !== null ? bestIdx : null;
    },
    findHoveredEdge: (mouseWorld, toleranceWorld) => {
        for (let i = STATE.document.shapes.length - 1; i >= 0; i--) {
            const shape = STATE.document.shapes[i];
            const edgeIndex = Input.findEdgeHit(shape, mouseWorld, toleranceWorld);
            if (edgeIndex !== null) {
                return { shape, edgeIndex };
            }
        }
        return null;
    },

    updateJSONExport: () => {
        const shape = STATE.selectedShape;
        if (!shape) {
            DOM.propJson.value = "";
            return;
        }
        const exportData = structuredClone(shape);
        DOM.propJson.value = JSON.stringify(exportData, null, 2);
    },

    // --- Canvas Routing ---
    handleCanvasClick: (e) => {
        if (Input.ignoreNextClick) {
            Input.ignoreNextClick = false;
            return;
        }
        if (e.button !== 0) return;
        
        if (STATE.ui.mode === 'DRAW') {
            const mouseWorld = Geometry.screenToWorld({ x: e.clientX, y: e.clientY }, STATE.ui.view);
            const mouseScreen = { x: e.clientX, y: e.clientY };
            DrawingOp.handleDrawClick(mouseWorld, mouseScreen);
        } else if (STATE.ui.mode === 'PULL') {
            return;
        } else {
            SelectionOp.handleSelect(e.ctrlKey);
            DOMRenderer.updatePropertiesPanel(STATE.selectedShape);
        }
    },

    handleMouseDown: (e) => {
        if (!DOM.boolMenu.classList.contains('hidden')) Input.hideBooleanMenu();
        if (!DOM.boardPresetMenu.classList.contains('hidden')) Input.hidePresetMenu();
        
        Input.mouseDownPos = { x: e.clientX, y: e.clientY };
        Input.isPanningInteraction = false;

        // Panning Logic
        if (e.button === 1 || (e.button === 0 && STATE.ui.isSpacePressed)) {
            Input.isPanningInteraction = true;
            ViewportOp.startPanning(e);
            if (STATE.ui.isSpacePressed) DOM.canvas.style.cursor = 'grabbing';
            return;
        }

        const mouseWorld = Geometry.screenToWorld({ x: e.clientX, y: e.clientY }, STATE.ui.view);

        if (e.button === 0 && STATE.ui.mode === 'SELECT') {
            // Check for joinery drag first
            if (STATE.selectedShape) {
                const shape = STATE.selectedShape;
                const scale = CONFIG.SCALE_PIXELS_PER_INCH;
                const { tenons, cutouts } = Input.activeFaceData();
                const { origin, xMult } = Geometry.getFaceOrigin(shape, shape.activeFace, scale);

                const findItem = (list) => {
                    if (!list) return null;
                    return list.find(item => {
                        const worldX = origin.x + (item.x * scale * xMult) - (xMult === -1 ? item.w * scale : 0);
                        const worldY = origin.y + item.y * scale;
                        return (mouseWorld.x >= worldX && mouseWorld.x <= worldX + item.w * scale &&
                                mouseWorld.y >= worldY && mouseWorld.y <= worldY + item.h * scale);
                    });
                };

                const foundCutout = findItem(cutouts);
                const foundTenon = findItem(tenons);
                
                if (foundCutout || foundTenon) {
                    const item = foundCutout || foundTenon;
                    const type = foundCutout ? 'cutout' : 'tenon';
                    // ... (dragging setup)
                    STATE.ui.dragging = { 
                        type: 'JOINERY', item, listType: type, shape, 
                        offset: { x: mouseWorld.x - (origin.x + (item.x * scale * xMult) - (xMult === -1 ? item.w * scale : 0)), 
                                  y: mouseWorld.y - (origin.y + item.y * scale) } 
                    };
                    return;
                }
            }
            
            // Then check for shape drag
            if (STATE.ui.hoveredShapeId) {
                STATE.ui.dragging = { 
                    type: 'SHAPE', 
                    item: STATE.hoveredShape, 
                    lastPos: { ...mouseWorld },
                    isCloneMode: e.ctrlKey || e.metaKey 
                };
                DOM.canvas.style.cursor = 'move';
            }
        }

        if (e.button === 0 && STATE.ui.mode === 'PULL') {
            // Check for edge drag on selected shape
            const toleranceWorld = (12 / STATE.ui.view.zoom);
            const hoveredEdge = Input.findHoveredEdge(mouseWorld, toleranceWorld);
            if (hoveredEdge) {
                const { shape, edgeIndex } = hoveredEdge;
                if (STATE.ui.selectedShapeId !== shape.id) {
                    Store.dispatch('SELECT_SHAPE', { ui: { selectedShapeId: shape.id } });
                }
                STATE.ui.dragging = {
                    type: 'EDGE',
                    item: shape,
                    edgeIndex,
                    lastPos: { ...mouseWorld }
                };
                DOM.canvas.style.cursor = 'move';
            }
        }
    },
    
    // ... (keep MouseMove, MouseUp, Wheel, Keys as is) ...
    handleMouseMove: (e) => {
        // Handle 3D Tooling (Raycasting etc)
        if (STATE.ui.is3DOpen) {
            ThreedOp.handleMouseMove(e);
            // If not dragging a UI element, block 2D canvas interactions
            if (!STATE.ui.dragging.type) return;
        }

        const mouseScreen = { x: e.clientX, y: e.clientY };
        const mouseWorld = Geometry.screenToWorld(mouseScreen, STATE.ui.view);

        if (STATE.ui.view.isPanning) {
            ViewportOp.updatePanning(e);
        } else if (STATE.ui.dragging.type) {
            DraggingOp.update(mouseWorld, mouseScreen);
        } else if (STATE.ui.mode === 'PULL') {
            const toleranceWorld = (12 / STATE.ui.view.zoom);
            const hoveredEdge = Input.findHoveredEdge(mouseWorld, toleranceWorld);
            STATE.ui.hoveredEdgeIndex = hoveredEdge ? hoveredEdge.edgeIndex : null;
            STATE.ui.hoveredEdgeShapeId = hoveredEdge ? hoveredEdge.shape.id : null;
            if (STATE.ui.hoveredEdgeIndex !== null) {
                DOM.canvas.style.cursor = 'move';
            } else {
                DOM.canvas.style.cursor = 'default';
            }
        } else if (STATE.ui.mode === 'DRAW') {
            DrawingOp.updatePreview(mouseWorld, mouseScreen);
        } else {
            SelectionOp.updateHoverState(mouseWorld);
        }
    },

    handleMouseUp: (e) => {
        const { ui } = STATE;
        ui.activeDrawing.alignmentGuide = null;

        if (ui.dragging.type === 'THICKNESS') {
            document.body.style.cursor = 'default';
            DocumentOp.updateJSONExport();
            ProjectOp.calculateTotalBoardFeet();
            Input.refreshView();
        } else if (ui.dragging.type === 'SHAPE') {
            const active = ui.dragging.item;
            const isFront = !active.activeFace || active.activeFace === 'FRONT';
            
            // Boolean ops only allowed on Front face for now
            if (isFront) {
                const target = STATE.document.shapes.find(s => s !== active && s.closed && BooleanOps.checkIntersection(active, s));
                
                if (target) {
                    // Show Menu
                    setTimeout(() => {
                        STATE.ui.boolCandidate = { active, target };
                        DOM.boolMenu.classList.remove('hidden');
                        DOM.boolMenu.style.left = `${e.clientX}px`;
                        DOM.boolMenu.style.top = `${e.clientY}px`;
                    }, 10);
                }
            }
            DocumentOp.updateJSONExport();
        } else if (ui.dragging.type === 'EDGE') {
            DocumentOp.updateJSONExport();
            ProjectOp.calculateTotalBoardFeet();
        } else if (ui.dragging.type === 'JOINERY') {
            DocumentOp.updateJSONExport();
        }

        ui.dragging.type = null;
        ui.dragging.item = null;
        
        if (Input.isPanningInteraction) {
            const start = Input.mouseDownPos || STATE.ui.view.panStart;
            const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
            if (dist > CONFIG.CLICK_TOLERANCE_SCREEN_PX) {
                Input.ignoreNextClick = true;
                // Clear flag eventually just in case click doesn't fire
                setTimeout(() => { Input.ignoreNextClick = false; }, 100);
            }
            Input.isPanningInteraction = false;
            ViewportOp.stopPanning();
        }
        
        DOM.canvas.style.cursor = ui.mode === 'DRAW' ? 'crosshair' : 'default';
    },
    
    hideBooleanMenu: () => {
        DOM.boolMenu.classList.add('hidden');
    },

    handleWheel: (e) => ViewportOp.handleZoom(e),

    handleContextMenu: (e) => {
        e.preventDefault();
        const menu = DOM.boardPresetMenu;
        menu.classList.remove('hidden');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        
        // Store the world position where the user right-clicked
        Input.lastContextMenuWorld = Geometry.screenToWorld({ x: e.clientX, y: e.clientY }, STATE.ui.view);
    },

    hidePresetMenu: () => {
        DOM.boardPresetMenu.classList.add('hidden');
    },

    handleAddPreset: (e) => {
        const btn = e.currentTarget;
        const w = parseFloat(btn.dataset.w);
        const t = parseFloat(btn.dataset.t);
        const length = 96; // 8 feet default
        
        // Use the stored world position
        const pos = Input.lastContextMenuWorld || { x: 0, y: 0 };
        const scale = CONFIG.SCALE_PIXELS_PER_INCH;
        
        // Create 2D rectangle (Width x Length)
        const points = [
            { x: pos.x, y: pos.y },
            { x: pos.x + w * scale, y: pos.y },
            { x: pos.x + w * scale, y: pos.y + length * scale },
            { x: pos.x, y: pos.y + length * scale }
        ];

        const name = btn.innerText.split(' (')[0];
        const newShape = ShapeModel.create(points, name);
        
        // Set standard thickness based on the preset actuals
        newShape.thickness = t; 
        
        // And recalculate side lengths for the 2D view
        Geometry.recalculateSideLengths(newShape.points, scale);

        Store.dispatch('SHAPE_ADD', {
            document: { shapes: [...STATE.document.shapes, newShape] },
            ui: { selectedShapeId: newShape.id }
        }, true);

        Input.hidePresetMenu();
    },

    handleKeyDown: (e) => {
        if (e.repeat) return;
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            Store.undo();
            e.preventDefault();
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            STATE.ui.isSpacePressed = true;
            if (!STATE.ui.view.isPanning) DOM.canvas.style.cursor = 'grab';
        }
        if (STATE.ui.mode === 'DRAW' && e.key === 'Escape') {
            DrawingOp.cancel();
        }
    },

    handleKeyUp: (e) => {
        if (e.key === ' ') {
            STATE.ui.isSpacePressed = false;
            
            // Abruptly end panning if it was active
            if (STATE.ui.view.isPanning) {
                ViewportOp.stopPanning();
                STATE.ui.view.isPanning = false; // Force flag clear
            }
            
            // Reset cursor immediately
            DOM.canvas.style.cursor = STATE.ui.mode === 'DRAW' ? 'crosshair' : 'default';
        }
    },

    refreshView: () => {
        if (STATE.ui.is3DOpen) {
            // Rebuild the 3D scene to reflect geometry changes
            STATE.renderer3D.clear3D();
            STATE.renderer3D.render3DScene(STATE.document.shapes);
        }
    },

    // --- UI Routing (Refactored) ---
    // updatePropertiesPanel moved to DOMRenderer
    // updateFaceSelector moved to DOMRenderer
    
    cycleFace: (delta) => {
        const shape = STATE.selectedShape;
        if (!shape) return;

        const faces = ['FRONT', 'BACK'];
        shape.points.forEach((p, i) => faces.push(`EDGE_${i}`));

        let currIdx = faces.indexOf(shape.activeFace || 'FRONT');
        if (currIdx === -1) currIdx = 0;

        let nextIdx = (currIdx + delta + faces.length) % faces.length;
        shape.activeFace = faces[nextIdx];

        DOMRenderer.updateFaceSelector(shape);
        DOMRenderer.renderJoineryList(shape);
        DocumentOp.updateJSONExport();
    },

    // renderJoineryList moved to DOMRenderer
    // createJoineryItemDOM moved to DOMRenderer

    handleAddCutout: () => JoineryOp.addCutout(),
    handleAddTenon: () => JoineryOp.addTenon(),
    handlePropChange: () => { DocumentOp.updateShapeName(DOM.propName.value); Input.refreshView(); Input.logState('Property Change'); },
    handleDeleteShape: () => {
        DocumentOp.deleteSelectedShape();
        Input.updateUIState();
        Input.refreshView();
        Input.logState('Shape Deleted');
    },
    handleJSONImport: () => { 
        if(DocumentOp.handleJSONImport()) {
            DOMRenderer.updatePropertiesPanel(STATE.selectedShape);
            Input.refreshView();
            Input.logState('JSON Import');
        }
    },
    
    // ... (Boolean Ops use DOMRenderer.updatePropertiesPanel)
    handleBooleanUnion: () => {
        if (!STATE.ui.boolCandidate) return;
        const { active, target } = STATE.ui.boolCandidate;
        const newPoints = BooleanOps.union(target, active);
        if (newPoints) {
            const newShape = ShapeModel.fromParent(active, newPoints);
            newShape.selected = true;
            
            // Calculate new shape list
            const newShapes = STATE.document.shapes.filter(s => s !== active && s !== target);
            newShapes.push(newShape);

            Store.dispatch('SHAPE_BOOLEAN_UNION', {
                document: { shapes: newShapes },
                ui: { selectedShapeId: newShape.id }
            });
            // ProjectOp.calculateTotalBoardFeet() needs to be called by Store or subscriber
            // For now, we can leave it here or move it. 
            // Better: Add a listener in ProjectOp for 'APP_STATE_CHANGED'?
            ProjectOp.calculateTotalBoardFeet(); 
        }
        Input.hideBooleanMenu();
    },

    handleBooleanSubtract: () => {
        if (!STATE.ui.boolCandidate) return;
        const { active, target } = STATE.ui.boolCandidate;
        const newPoints = BooleanOps.subtract(target, active);
        if (newPoints) {
             const newShape = ShapeModel.fromParent(target, newPoints);
             newShape.selected = true;
             
             const newShapes = STATE.document.shapes.filter(s => s !== active && s !== target);
             newShapes.push(newShape);

             Store.dispatch('SHAPE_BOOLEAN_SUBTRACT', {
                document: { shapes: newShapes },
                ui: { selectedShapeId: newShape.id }
             });
             ProjectOp.calculateTotalBoardFeet();
        }
        Input.hideBooleanMenu();
    },
    
    // ... (rest is same)
    handleThicknessMouseDown: (e) => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        STATE.ui.dragging = { type: 'THICKNESS', item: shape, startPos: { x: e.clientX, y: e.clientY }, initialVal: shape.thickness || CONFIG.DEFAULT_THICKNESS };
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    },

    handleReset: () => {
        STATE.document.shapes = [];
        Input.switchTool('SELECT'); // Reset tool
        STATE.ui.selectedShapeId = null;
        DOM.propPanel.classList.add('hidden');
        Input.updateUIState();
        ProjectOp.calculateTotalBoardFeet();
    },

    updateUIState: () => {
        // No longer toggling 3D button based on shapes
    },

    switchTool: (mode) => {
        STATE.ui.mode = mode; // 'DRAW' | 'SELECT' | 'PULL'
        STATE.ui.drawState = 'IDLE';
        STATE.ui.activeDrawing.points = [];
        STATE.ui.hoveredEdgeIndex = null;
        STATE.ui.hoveredEdgeShapeId = null;
        
        DOM.btnModeDraw.classList.toggle('active', mode === 'DRAW');
        DOM.btnModeSelect.classList.toggle('active', mode === 'SELECT');
        DOM.btnModePull.classList.toggle('active', mode === 'PULL');
        DOM.canvas.style.cursor = mode === 'DRAW' ? 'crosshair' : 'default';
    },

    switchView: (viewMode) => {
        // Prevent 3D if no shapes
        if (viewMode === '3D' && STATE.document.shapes.length === 0) {
            alert("Draw a shape first!");
            return;
        }

        const is3D = viewMode === '3D';
        STATE.ui.is3DOpen = is3D;

        // Capture size BEFORE hiding the 2D canvas
        const rect = DOM.canvas.getBoundingClientRect();

        DOM.btnView2D.classList.toggle('active', !is3D);
        DOM.btnView3D.classList.toggle('active', is3D);
        
        DOM.canvas.classList.toggle('hidden', is3D);
        DOM.canvas3D.classList.toggle('hidden', !is3D);
        
        // Toggle Toolbars
        DOM.controls2D.classList.toggle('hidden', is3D);
        DOM.controls3D.classList.toggle('hidden', !is3D);

        if (is3D) {
            Input.switchTool('SELECT'); // Force select mode
            DOM.btnModeDraw.disabled = true;
            DOM.btnModeDraw.classList.add('disabled'); // Visual feedback
            Input.open3DMode(rect);
        } else {
            DOM.btnModeDraw.disabled = false;
            DOM.btnModeDraw.classList.remove('disabled');
            Input.close3DMode();
        }
    },

    open3DMode: (rect) => {
        STATE.ui.is3DOpen = true;
        
        // Ensure visible before sizing (already handled in switchView, but safe to keep)
        DOM.canvas3D.classList.remove('hidden');
        
        // Use passed rect or fallback
        const width = rect ? rect.width : DOM.canvas.clientWidth;
        const height = rect ? rect.height : DOM.canvas.clientHeight;

        STATE.renderer3D.resize(width, height);
        STATE.renderer3D.setMode('3D');
        STATE.renderer3D.render3DScene(STATE.document.shapes, true);
    },

    close3DMode: () => {
        STATE.ui.is3DOpen = false;
        STATE.renderer3D.setMode('2D'); // Reset to 2D state/cleanup
        STATE.renderer3D.clear3D(); 
    },
    
    // Debug
    logState: (action) => {
        console.group(`[State Update] ${action}`);
        console.log('UI State:', structuredClone(STATE.ui));
        console.log('Document:', structuredClone(STATE.document));
        console.groupEnd();
    }
};

// Global for UI callbacks
window.InputRef = Input;
