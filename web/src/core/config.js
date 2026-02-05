/**
 * @fileoverview Configuration Constants
 * Defines all visual parameters, limits, and tolerances for the application.
 */

export const CONFIG = {
    // Visuals
    COLORS: {
        GRID: '#e9e9e9',
        SHAPE_DEFAULT: '#333333',
        SHAPE_SELECTED: '#007bff',
        SHAPE_HOVER: '#6c757d',
        SHAPE_EDGE_HOVER: '#ff8f00',
        SHAPE_FILL: 'rgba(224, 192, 151, 0.5)',
        SHAPE_FILL_SELECTED: 'rgba(0, 123, 255, 0.1)',
        GUIDE_LINE: '#007bff',
        ALIGNMENT_GUIDE: '#ffc107',
        SNAP_POINT: 'rgba(0, 255, 0, 0.5)',
        TEXT: '#333333',
        TEXT_BG: 'white'
    },
    // Viewport Limits
    ZOOM: {
        MIN: 0.1,
        MAX: 20.0,
        SENSITIVITY: 0.001
    },
    // Interaction Tolerances
    SNAP_RADIUS_SCREEN_PX: 15,
    CLICK_TOLERANCE_SCREEN_PX: 10,
    SCALE_PIXELS_PER_INCH: 10,
    DEFAULT_THICKNESS: 1.0,
    
    // UI Elements
    ARROW_GRID_RADIUS: 40,
    ARROW_SIZE: 10
};
