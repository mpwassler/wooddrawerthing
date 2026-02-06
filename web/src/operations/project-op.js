/**
 * @fileoverview Project Operations
 * Handles creation, selection, and management of projects.
 */

import { STATE } from '../core/state.js';
import { Storage } from '../core/storage.js';
import { DOM } from '../core/dom.js';
import { Input } from '../systems/input.js';
import { Geometry } from '../utils/geometry.js';
import { CONFIG } from '../core/config.js';

export const ProjectOp = {
    init: async () => {
        await Storage.init();
        const projects = await Storage.getAllProjects();
        STATE.document.projects = projects;

        if (projects.length > 0) {
            ProjectOp.selectProject(projects[0].id);
        } else {
            await ProjectOp.createNewProject("My First Project");
        }
        ProjectOp.renderProjectList();
        Input.updateUIState();
        ProjectOp.calculateTotalBoardFeet();
        STATE.requestRender?.();
    },

    createNewProject: async (name) => {
        const newProject = {
            id: Math.random().toString(36).substr(2, 9),
            name: name || "Untitled Project",
            shapes: []
        };
        STATE.document.projects.push(newProject);
        await Storage.saveProject(newProject);
        ProjectOp.selectProject(newProject.id);
        ProjectOp.renderProjectList();
        ProjectOp.calculateTotalBoardFeet();
        STATE.requestRender?.();
    },

    selectProject: (id) => {
        STATE.document.currentProjectId = id;
        STATE.ui.selectedShapeId = null;
        DOM.propPanel.classList.add('hidden');
        ProjectOp.renderProjectList();
        Input.updateUIState();
        ProjectOp.calculateTotalBoardFeet();
        STATE.requestRender?.();
    },

    saveCurrentProject: async () => {
        if (STATE.document.currentProject) {
            await Storage.saveProject(STATE.document.currentProject);
        }
    },

    deleteProject: async (id) => {
        if (STATE.document.projects.length <= 1) {
            alert("Cannot delete the last project.");
            return;
        }
        STATE.document.projects = STATE.document.projects.filter(p => p.id !== id);
        await Storage.deleteProject(id);
        if (STATE.document.currentProjectId === id) {
            ProjectOp.selectProject(STATE.document.projects[0].id);
        }
        ProjectOp.renderProjectList();
        STATE.requestRender?.();
    },

    calculateTotalBoardFeet: () => {
        if (!DOM.totalBoardFeet || !STATE.document.shapes) return;
        
        let totalBF = 0;
        STATE.document.shapes.forEach(shape => {
            const areaSqIn = Geometry.calculateArea(shape.points, CONFIG.SCALE_PIXELS_PER_INCH);
            const thickness = shape.thickness || CONFIG.DEFAULT_THICKNESS;
            const volume = areaSqIn * thickness;
            const bf = volume / 144;
            totalBF += bf;
        });
        
        DOM.totalBoardFeet.innerText = `${totalBF.toFixed(2)} Board Feet`;
    },

    renderProjectList: () => {
        if (!DOM.projectList) return;
        DOM.projectList.innerHTML = '';
        STATE.document.projects.forEach(p => {
            const isActive = p.id === STATE.document.currentProjectId;
            const div = document.createElement('div');
            div.className = `project-item ${isActive ? 'active' : ''}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.innerText = p.name;
            div.appendChild(nameSpan);

            // Single click to select (only if not already active or already editing)
            div.onclick = () => {
                if (STATE.document.currentProjectId !== p.id) {
                    ProjectOp.selectProject(p.id);
                }
            };

            // Double click to rename
            div.ondblclick = (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = p.name;
                input.style.cssText = "width: 100%; padding: 2px; font-size: 0.9em;";
                
                let finished = false;
                const saveName = async () => {
                    if (finished) return;
                    finished = true;
                    const newName = input.value.trim();
                    if (newName && newName !== p.name) {
                        p.name = newName;
                        await Storage.saveProject(p);
                    }
                    ProjectOp.renderProjectList();
                };

                input.onkeydown = (ev) => {
                    if (ev.key === 'Enter') saveName();
                    if (ev.key === 'Escape') { finished = true; ProjectOp.renderProjectList(); }
                };
                input.onblur = saveName;

                // Replace span with input
                div.replaceChild(input, nameSpan);
                input.focus();
                input.select();
            };

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'project-delete-btn';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                ProjectOp.deleteProject(p.id);
            };
            div.appendChild(delBtn);

            DOM.projectList.appendChild(div);
        });
    }
};
