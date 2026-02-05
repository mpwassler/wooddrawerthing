/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreedOp } from './threed-op.js';
import { STATE } from '../core/state.js';
import { Store } from '../core/store.js';
import * as THREE from 'https://esm.sh/three@0.160.0';

// Mock Store
vi.mock('../core/store.js', () => ({
    Store: {
        dispatch: vi.fn()
    }
}));

// Mock THREE.js
vi.mock('https://esm.sh/three@0.160.0', () => {
    const Raycaster = vi.fn();
    Raycaster.prototype.setFromCamera = vi.fn();
    Raycaster.prototype.intersectObjects = vi.fn();
    
    return {
        Raycaster,
        Vector2: vi.fn(),
        Group: vi.fn(() => ({ children: [] }))
    };
});

vi.mock('../systems/input.js', () => ({
    Input: {
        activeFaceData: vi.fn()
    }
}));

vi.mock('../utils/boolean-ops.js', () => ({
    BooleanOps: {}
}));

vi.mock('./slice-op.js', () => ({
    SliceOp: {
        clearPreview: vi.fn(),
        handleMouseMove: vi.fn(),
        handleClick: vi.fn()
    }
}));

describe('ThreedOp - 3D to 2D Reflection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        const mockShape = {
            id: 'shape-1',
            name: 'Original',
            points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
            transform3D: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
            faceData: { FRONT: { tenons: [], cutouts: [] } }
        };

        // Mock State
        STATE.document = {
            projects: [{ id: 'p1', shapes: [mockShape] }],
            currentProjectId: 'p1',
            get currentProject() { return this.projects[0]; },
            get shapes() { return this.currentProject.shapes; }
        };

        STATE.renderer3D = {
            mode: '3D',
            canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
            cameraPersp: {},
            extrudedMeshes: [
                { userData: { shapeId: 'shape-1' } }
            ],
            transformControls: { 
                children: [], 
                attach: vi.fn(),
                detach: vi.fn(),
                dragging: false,
                axis: null
            }
        };
    });

    it('should offset 2D points when cloning in 3D so it reflects in the 2D scene', () => {
        // 1. Setup Mock Raycaster to "hit" the shape
        const raycasterInstance = new THREE.Raycaster();
        raycasterInstance.intersectObjects.mockReturnValue([
            { object: { userData: { shapeId: 'shape-1' } } }
        ]);

        // 2. Simulate Ctrl + Mousedown
        const mockEvent = {
            clientX: 50,
            clientY: 50,
            ctrlKey: true,
            button: 0
        };

        ThreedOp.handleMouseDown(mockEvent);

        // 3. Verify SHAPE_ADD_3D was dispatched
        expect(Store.dispatch).toHaveBeenCalledWith('SHAPE_ADD_3D', expect.anything(), true);

        // 4. THE BUG CHECK: Get the new shape from the dispatch call
        const payload = Store.dispatch.mock.calls[0][1];
        const newShape = payload.document.shapes[1];

        // Check if 2D points were offset. 
        // Currently, only transform3D is offset, so this SHOULD FAIL because points[0] will still be {0,0}
        expect(newShape.points[0].x).not.toBe(0);
        expect(newShape.points[0].y).not.toBe(0);
    });
});
