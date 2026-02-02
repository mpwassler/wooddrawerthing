/**
 * @fileoverview Application State
 * Centralized store separating Document Data from UI State.
 */

export const STATE = {
    // --- Document Data (The Blueprint) ---
    // This is what gets saved/loaded as JSON
    document: {
        projects: [], // Array of { id, name, shapes }
        currentProjectId: null,
        get currentProject() {
            return this.projects.find(p => p.id === this.currentProjectId);
        },
        get shapes() {
            return this.currentProject ? this.currentProject.shapes : [];
        },
        set shapes(val) {
            if (this.currentProject) this.currentProject.shapes = val;
        }
    },

    // --- UI & View State (Transient) ---
    ui: {
        mode: 'DRAW',   // 'DRAW' | 'SELECT'
        drawState: 'IDLE', // 'IDLE' | 'START_SHAPE' | 'DRAWING_LINE'
        is3DOpen: false,
        
        // Selection
        selectedShapeId: null, 
        hoveredShapeId: null,
        
        // Viewport
        view: {
            pan: { x: 0, y: 0 },
            zoom: 1.0,
            isPanning: false,
            panStart: { x: 0, y: 0 }
        },

        // Active Interactions
        activeDrawing: {
            points: [],
            tempLine: null,
            selectedDirection: null,
            highlightedDirection: null,
            snapTarget: null,
            alignmentGuide: null
        },

        dragging: {
            type: null, // 'SHAPE' | 'JOINERY' | 'THICKNESS'
            item: null, // Reference or ID
            startPos: { x: 0, y: 0 },
            offset: { x: 0, y: 0 }
        },

        animation: {
            target: null,
            startTime: 0,
            duration: 400,
            active: false
        }
    },

    // --- System Refs ---
    renderer: null,
    renderer3D: null,
    overlay: null,

    // --- Getters for Convenience ---
    get selectedShape() {
        return this.document.shapes.find(s => s.id === this.ui.selectedShapeId);
    },
    get hoveredShape() {
        return this.document.shapes.find(s => s.id === this.ui.hoveredShapeId);
    }
};