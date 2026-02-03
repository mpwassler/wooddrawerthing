/**
 * @fileoverview DOM Elements
 * Centralized references to DOM elements.
 */

export const DOM = {
    canvas: document.getElementById('drawing-canvas'),
    overlay: document.getElementById('overlay-canvas'),
    input: document.getElementById('measurement-input'),
    btnApply: document.getElementById('apply-measurement'),
    btnReset: document.getElementById('reset-drawing'),
    totalBoardFeet: document.getElementById('total-board-feet'),
    btnModeDraw: document.getElementById('draw-mode-btn'),
    btnModeSelect: document.getElementById('select-mode-btn'),
    btnView2D: document.getElementById('view-2d-btn'),
    btnView3D: document.getElementById('view-3d-btn'),
    
    // Toolbars
    controls2D: document.getElementById('2d-controls'),
    controls3D: document.getElementById('3d-controls'),
    btnResetCam: document.getElementById('reset-cam-btn'),
    btnToolSlice: document.getElementById('tool-slice-btn'),
    
    // Properties Panel
    propPanel: document.getElementById('properties-panel'),
    propName: document.getElementById('prop-name'),
    propThickness: document.getElementById('prop-thickness'),
    propLength: document.getElementById('prop-length'),
    propDelete: document.getElementById('prop-delete'),
    propJson: document.getElementById('prop-json'),
    btnAddCutout: document.getElementById('add-cutout-btn'),
    btnAddTenon: document.getElementById('add-tenon-btn'),
    joineryList: document.getElementById('joinery-list'),

    // 3D Canvas
    canvas3D: document.getElementById('canvas-3d'),

    // Boolean Menu
    boolMenu: document.getElementById('boolean-menu'),
    btnBoolUnion: document.getElementById('bool-union-btn'),
    btnBoolSubtract: document.getElementById('bool-subtract-btn'),
    btnBoolCancel: document.getElementById('bool-cancel-btn'),

    // Projects
    projectList: document.getElementById('project-list'),
    btnAddProject: document.getElementById('add-project-btn'),

    // Projects
    projectList: document.getElementById('project-list'),
    btnAddProject: document.getElementById('add-project-btn'),

    // Faces
    facePrevBtn: document.getElementById('face-prev-btn'),
    faceNextBtn: document.getElementById('face-next-btn'),
    faceLabel: document.getElementById('face-label'),
};
