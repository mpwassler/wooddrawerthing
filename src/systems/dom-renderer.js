/**
 * @fileoverview DOM Renderer
 * Handles updates to the HTML overlay (Properties Panel, Joinery List, etc.)
 * reacting to state changes.
 */

import { STATE } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Geometry } from '../utils/geometry.js';
import { JoineryOp } from '../operations/joinery-op.js';
import { DocumentOp } from '../operations/document-op.js';
import { Input } from './input.js'; 

const getActiveFaceData = () => {
    const shape = STATE.selectedShape;
    if (!shape || !shape.faceData) return { tenons: [], cutouts: [] };
    return shape.faceData[shape.activeFace || 'FRONT'] || { tenons: [], cutouts: [] };
};

export const DOMRenderer = {
    updatePropertiesPanel: (shape) => {
        if (!shape) { DOM.propPanel.classList.add('hidden'); return; }
        DOM.propPanel.classList.remove('hidden');
        DOM.propName.value = shape.name;
        DOM.propThickness.value = Geometry.formatInches(shape.thickness || 1.0);
        
        let totalLen = 0;
        shape.points.forEach(p => { if (p.lengthToNext) totalLen += p.lengthToNext; });
        DOM.propLength.textContent = Geometry.formatInches(totalLen);
        
        DOMRenderer.updateFaceSelector(shape);
        DOMRenderer.renderJoineryList(shape);
        DocumentOp.updateJSONExport();
    },

    updateFaceSelector: (shape) => {
        if (!shape) return;
        let label = "Front";
        if (shape.activeFace === 'BACK') label = "Back";
        else if (shape.activeFace && shape.activeFace.startsWith('EDGE_')) {
            const idx = parseInt(shape.activeFace.split('_')[1]);
            label = `Edge ${idx + 1}`;
        }
        DOM.faceLabel.innerText = label;
    },

    renderJoineryList: (shape) => {
        if (!shape) return;
        DOM.joineryList.innerHTML = '';
        
        const { tenons, cutouts } = getActiveFaceData();
        
        if (cutouts) cutouts.forEach((c, i) => DOMRenderer.createJoineryItemDOM('Cutout', c, i, 'cutout'));
        if (tenons) tenons.forEach((t, i) => DOMRenderer.createJoineryItemDOM('Tenon', t, i, 'tenon'));
    },

    createJoineryItemDOM: (label, data, index, type) => {
        const div = document.createElement('div');
        div.className = `joinery-item ${type}`;
        
        const top = document.createElement('div');
        top.className = 'joinery-header';
        top.innerText = `${label} ${index + 1}`;
        const del = document.createElement('button');
        del.innerHTML = '&times;';
        del.className = 'joinery-delete-btn';
        del.onclick = () => { 
            JoineryOp.removeJoinery(type, index); 
            DOMRenderer.renderJoineryList(STATE.selectedShape);
            if(window.InputRef) window.InputRef.refreshView(); 
        };
        top.appendChild(del);
        div.appendChild(top);

        const dims = document.createElement('div');
        dims.className = 'joinery-dims';
        const addInp = (f, l) => {
            dims.appendChild(document.createTextNode(l));
            const i = document.createElement('input');
            i.type = 'number'; i.value = data[f]; i.step = 0.125; i.style.width = '40px';
            i.onchange = (e) => { 
                data[f] = parseFloat(e.target.value); 
                DocumentOp.updateJSONExport(); 
                if(window.InputRef) window.InputRef.refreshView();
            };
            dims.appendChild(i);
        };
        addInp('w', 'W:'); addInp('h', 'H:');
        if (type === 'tenon') addInp('inset', 'In:');
        addInp('depth', 'D:');
        div.appendChild(dims);
        DOM.joineryList.appendChild(div);
    }
};
