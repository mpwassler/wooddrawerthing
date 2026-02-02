/**
 * @fileoverview Input System
 * Routes low-level events to specialized Operations.
 */

import { STATE } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Geometry } from '../utils/geometry.js?v=5';
import { BooleanOps } from '../utils/boolean-ops.js';
import { CONFIG } from '../core/config.js';
import { ViewportOp } from '../operations/viewport-op.js';
import { SelectionOp } from '../operations/selection-op.js';
import { DrawingOp } from '../operations/drawing-op.js';
import { DraggingOp } from '../operations/dragging-op.js';
import { JoineryOp } from '../operations/joinery-op.js';
import { DocumentOp } from '../operations/document-op.js';
import { ProjectOp } from '../operations/project-op.js';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const Input = {
    // --- Helpers ---
    activeFaceData: () => {
        const shape = STATE.selectedShape;
        if (!shape || !shape.faceData) return { tenons: [], cutouts: [] };
        return shape.faceData[shape.activeFace || 'FRONT'] || { tenons: [], cutouts: [] };
    },

    updateJSONExport: () => {
        const shape = STATE.selectedShape;
        if (!shape) {
            DOM.propJson.value = "";
            return;
        }
        const exportData = JSON.parse(JSON.stringify(shape));
        DOM.propJson.value = JSON.stringify(exportData, null, 2);
    },

    // --- Canvas Routing ---
    handleCanvasClick: (e) => {
        if (e.button !== 0 || STATE.ui.view.isPanning) return;
        if (STATE.ui.mode === 'DRAW') {
            const mouseWorld = Geometry.screenToWorld({ x: e.clientX, y: e.clientY }, STATE.ui.view);
            const mouseScreen = { x: e.clientX, y: e.clientY };
            const newShape = DrawingOp.handleDrawClick(mouseWorld, mouseScreen);
            if (newShape) {
                STATE.ui.selectedShapeId = newShape.id;
                Input.updatePropertiesPanel(newShape);
                Input.updateUIState();
            }
        } else {
            SelectionOp.handleSelect(e.ctrlKey);
            Input.updatePropertiesPanel(STATE.selectedShape);
        }
    },

    handleMouseDown: (e) => {
        if (!DOM.boolMenu.classList.contains('hidden')) Input.hideBooleanMenu();

        if (e.button === 1) {
            ViewportOp.startPanning(e);
            return;
        }

        const mouseWorld = Geometry.screenToWorld({ x: e.clientX, y: e.clientY }, STATE.ui.view);

        if (e.button === 0 && STATE.ui.mode === 'SELECT') {
            // Check for joinery drag first
            if (STATE.selectedShape) {
                const shape = STATE.selectedShape;
                const scale = CONFIG.SCALE_PIXELS_PER_INCH;
                
                // Use active face data for detection
                const { tenons, cutouts } = Input.activeFaceData();
                
                let cx = 0, cy = 0;
                shape.points.forEach(p => { cx += p.x; cy += p.y; });
                cx /= shape.points.length; cy /= shape.points.length;

                let origin = shape.points[0];
                let xMultiplier = 1;

                if (shape.activeFace === 'BACK') {
                    origin = { x: 2 * cx - shape.points[0].x, y: shape.points[0].y };
                    xMultiplier = -1;
                } else if (shape.activeFace && shape.activeFace.startsWith('EDGE_')) {
                    const edgeIdx = parseInt(shape.activeFace.split('_')[1]);
                    const edgeLen = shape.points[edgeIdx].lengthToNext || 0;
                    const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
                    origin = { x: cx - (edgeLen * scale) / 2, y: cy - (thickness * scale) / 2 };
                }

                const findItem = (list) => {
                    if (!list) return null;
                    return list.find(item => {
                        const worldX = origin.x + (item.x * scale * xMultiplier) - (xMultiplier === -1 ? item.w * scale : 0);
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
                    
                    const worldX = origin.x + (item.x * scale * xMultiplier) - (xMultiplier === -1 ? item.w * scale : 0);
                    const worldY = origin.y + item.y * scale;
                    
                    STATE.ui.dragging = { 
                        type: 'JOINERY', 
                        item, 
                        listType: type, 
                        shape, 
                        offset: { x: mouseWorld.x - worldX, y: mouseWorld.y - worldY } 
                    };
                    return;
                }
            }

            // Then check for shape drag
            if (STATE.ui.hoveredShapeId) {
                STATE.ui.dragging = { type: 'SHAPE', item: STATE.hoveredShape, lastPos: { ...mouseWorld } };
                DOM.canvas.style.cursor = 'move';
            }
        }
    },

    handleMouseMove: (e) => {
        const mouseScreen = { x: e.clientX, y: e.clientY };
        const mouseWorld = Geometry.screenToWorld(mouseScreen, STATE.ui.view);

        if (STATE.ui.view.isPanning) {
            ViewportOp.updatePanning(e);
        } else if (STATE.ui.dragging.type) {
            DraggingOp.update(mouseWorld, mouseScreen);
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
        } else if (ui.dragging.type === 'JOINERY') {
            DocumentOp.updateJSONExport();
        }

        ui.dragging.type = null;
        ui.dragging.item = null;
        ViewportOp.stopPanning();
        DOM.canvas.style.cursor = ui.mode === 'DRAW' ? 'crosshair' : 'default';
    },

    handleWheel: (e) => ViewportOp.handleZoom(e),

    handleKeyDown: (e) => {
        if (STATE.ui.mode === 'DRAW' && e.key === 'Escape') {
            DrawingOp.cancel();
        }
    },

    // --- UI Routing ---
    updatePropertiesPanel: (shape) => {
        if (!shape) { DOM.propPanel.classList.add('hidden'); return; }
        DOM.propPanel.classList.remove('hidden');
        DOM.propName.value = shape.name;
        DOM.propThickness.value = Geometry.formatInches(shape.thickness || CONFIG.DEFAULT_THICKNESS);
        let totalLen = 0;
        shape.points.forEach(p => { if (p.lengthToNext) totalLen += p.lengthToNext; });
        DOM.propLength.textContent = Geometry.formatInches(totalLen);
        Input.renderJoineryList();
        DocumentOp.updateJSONExport();
    },

    updateFaceSelector: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        
        let label = "Front";
        if (shape.activeFace === 'BACK') label = "Back";
        else if (shape.activeFace && shape.activeFace.startsWith('EDGE_')) {
            const idx = parseInt(shape.activeFace.split('_')[1]);
            label = `Edge ${idx + 1}`;
        }
        DOM.faceLabel.innerText = label;
    },

    cycleFace: (delta) => {
        const shape = STATE.selectedShape;
        if (!shape) return;

        // 1. Build Face Buffer
        const faces = ['FRONT', 'BACK'];
        shape.points.forEach((p, i) => faces.push(`EDGE_${i}`));

        // 2. Find Current Index
        let currIdx = faces.indexOf(shape.activeFace || 'FRONT');
        if (currIdx === -1) currIdx = 0;

        // 3. Cycle with Wrap
        let nextIdx = (currIdx + delta + faces.length) % faces.length;
        shape.activeFace = faces[nextIdx];

        // 4. Update UI
        Input.updateFaceSelector();
        Input.renderJoineryList();
        DocumentOp.updateJSONExport();
    },

    renderJoineryList: () => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        DOM.joineryList.innerHTML = '';
        
        const { tenons, cutouts } = Input.activeFaceData();
        
        if (cutouts) cutouts.forEach((c, i) => Input.createJoineryItemDOM('Cutout', c, i, 'cutout', '#ffebee'));
        if (tenons) tenons.forEach((t, i) => Input.createJoineryItemDOM('Tenon', t, i, 'tenon', '#e8f5e9'));
        
        DocumentOp.updateJSONExport();
    },

    createJoineryItemDOM: (label, data, index, type, bg) => {
        const div = document.createElement('div');
        div.style.cssText = `background:${bg}; padding:6px; border-radius:4px; margin-bottom:5px;`;
        
        const top = document.createElement('div');
        top.style.cssText = `display:flex; justify-content:space-between; font-weight:bold; font-size:0.9em;`;
        top.innerText = `${label} ${index + 1}`;
        const del = document.createElement('button');
        del.innerHTML = '&times;';
        del.style.cssText = `background:none; border:none; cursor:pointer; color:#666; font-weight:bold;`;
        del.onclick = () => { JoineryOp.removeJoinery(type, index); Input.renderJoineryList(); };
        top.appendChild(del);
        div.appendChild(top);

        const dims = document.createElement('div');
        dims.style.cssText = `display:flex; gap:5px; margin-top:4px; align-items:center;`;
        const addInp = (f, l) => {
            dims.appendChild(document.createTextNode(l));
            const i = document.createElement('input');
            i.type = 'number'; i.value = data[f]; i.step = 0.125; i.style.width = '40px';
            i.onchange = (e) => { data[f] = parseFloat(e.target.value); DocumentOp.updateJSONExport(); };
            dims.appendChild(i);
        };
        addInp('w', 'W:'); addInp('h', 'H:');
        if (type === 'tenon') addInp('inset', 'In:');
        addInp('depth', 'D:');
        div.appendChild(dims);
        DOM.joineryList.appendChild(div);
    },

    handleAddCutout: () => { JoineryOp.addCutout(); Input.renderJoineryList(); },
    handleAddTenon: () => { JoineryOp.addTenon(); Input.renderJoineryList(); },
    handlePropChange: () => DocumentOp.updateShapeName(DOM.propName.value),
    handleDeleteShape: () => {
        DocumentOp.deleteSelectedShape();
        Input.updateUIState();
    },
    handleJSONImport: () => { if(DocumentOp.handleJSONImport()) Input.updatePropertiesPanel(STATE.selectedShape); },
    
    hideBooleanMenu: () => {
        DOM.boolMenu.classList.add('hidden');
        STATE.ui.boolCandidate = null;
    },

    handleBooleanUnion: () => {
        if (!STATE.ui.boolCandidate) return;
        const { active, target } = STATE.ui.boolCandidate;
        const newPoints = BooleanOps.union(target, active);
        if (newPoints) {
            const newShape = { ...JSON.parse(JSON.stringify(active)), id: generateId(), points: newPoints };
            newShape.selected = true;
            Geometry.recalculateSideLengths(newShape.points, CONFIG.SCALE_PIXELS_PER_INCH);
            STATE.document.shapes = STATE.document.shapes.filter(s => s !== active && s !== target);
            STATE.document.shapes.push(newShape);
            STATE.ui.selectedShapeId = newShape.id;
            Input.updatePropertiesPanel(newShape);
            Input.updateUIState();
            ProjectOp.calculateTotalBoardFeet();
        }
        Input.hideBooleanMenu();
    },

    handleBooleanSubtract: () => {
        if (!STATE.ui.boolCandidate) return;
        const { active, target } = STATE.ui.boolCandidate;
        const newPoints = BooleanOps.subtract(target, active);
        if (newPoints) {
             const newShape = { ...JSON.parse(JSON.stringify(target)), id: generateId(), points: newPoints };
             newShape.selected = true;
             Geometry.recalculateSideLengths(newShape.points, CONFIG.SCALE_PIXELS_PER_INCH);
             STATE.document.shapes = STATE.document.shapes.filter(s => s !== active && s !== target);
             STATE.document.shapes.push(newShape);
             STATE.ui.selectedShapeId = newShape.id;
             Input.updatePropertiesPanel(newShape);
             Input.updateUIState();
             ProjectOp.calculateTotalBoardFeet();
        }
        Input.hideBooleanMenu();
    },
    
    handleThicknessMouseDown: (e) => {
        const shape = STATE.selectedShape;
        if (!shape) return;
        STATE.ui.dragging = { type: 'THICKNESS', item: shape, startPos: { x: e.clientX, y: e.clientY }, initialVal: shape.thickness || CONFIG.DEFAULT_THICKNESS };
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    },

    handleInputApply: () => {
        // Simple delegator for length input
        const val = Geometry.parseMeasurement(DOM.input.value);
        if (val === null || STATE.ui.drawState !== 'DRAWING_LINE') return;
        // In this specific case, we'll keep the logic in Input for now or move to DrawingOp
        // For simplicity of refactor, let's just use the logic from before
        const pts = STATE.ui.activeDrawing.points;
        const active = pts[pts.length - 1];
        const dir = Geometry.normalize(STATE.ui.activeDrawing.selectedDirection);
        const endPt = { x: active.x + dir.x * (val * CONFIG.SCALE_PIXELS_PER_INCH), y: active.y + dir.y * (val * CONFIG.SCALE_PIXELS_PER_INCH) };
        active.lengthToNext = val;
        pts.push(endPt);
        STATE.ui.drawState = 'START_SHAPE';
        STATE.ui.activeDrawing.selectedDirection = null;
        DOM.input.value = '';
        ProjectOp.calculateTotalBoardFeet();
    },

    handleReset: () => {
        STATE.document.shapes = [];
        STATE.ui.drawState = 'IDLE';
        STATE.ui.selectedShapeId = null;
        DOM.propPanel.classList.add('hidden');
        Input.updateUIState();
        ProjectOp.calculateTotalBoardFeet();
    },

    updateUIState: () => {
        const hasShapes = STATE.document.shapes.length > 0;
        DOM.btnView3D.classList.toggle('hidden', !hasShapes);
    },

    switchMode: (mode) => {
        STATE.ui.mode = mode;
        STATE.ui.drawState = 'IDLE';
        STATE.ui.activeDrawing.points = [];
        DOM.btnModeDraw.classList.toggle('active', mode === 'DRAW');
        DOM.btnModeSelect.classList.toggle('active', mode === 'SELECT');
        DOM.canvas.style.cursor = mode === 'DRAW' ? 'crosshair' : 'default';
    },

    open3DMode: () => {
        if (STATE.document.shapes.length === 0) return;
        STATE.ui.is3DOpen = true;
        DOM.modal3D.classList.remove('hidden');
        const rect = DOM.canvas3D.getBoundingClientRect();
        STATE.renderer3D.resize(rect.width, rect.height);
        STATE.renderer3D.render3DScene(STATE.document.shapes);
    },

    close3DMode: () => {
        STATE.ui.is3DOpen = false;
        DOM.modal3D.classList.add('hidden');
        STATE.renderer3D.clear3D();
    }
};