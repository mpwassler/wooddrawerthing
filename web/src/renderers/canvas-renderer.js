/**
 * @fileoverview Renderer Interface
 * Abstraction layer for drawing 2D primitives. 
 * Currently implemented using HTML5 Canvas API.
 * 
 * Goals:
 * - Agnostic of application state or business logic.
 * - Receives raw coordinates and style configuration.
 * - Supports coordinate system transformations (World vs Screen).
 */

export class CanvasRenderer {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.width = canvasElement.width;
        this.height = canvasElement.height;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Applies a 2D transformation matrix (pan/zoom)
     * @param {number} tx - Translate X
     * @param {number} ty - Translate Y
     * @param {number} s - Scale factor
     */
    pushWorldTransform(tx, ty, s) {
        this.ctx.save();
        this.ctx.translate(tx, ty);
        this.ctx.scale(s, s);
    }

    popTransform() {
        this.ctx.restore();
    }

    /**
     * Draws an infinite grid.
     * @param {Object} bounds - {left, top, right, bottom} in World Coordinates
     * @param {number} step - Grid cell size in World Units
     * @param {string} color
     * @param {number} lineWidth
     */
    drawGrid(bounds, step, color, lineWidth) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        const startX = Math.floor(bounds.left / step) * step;
        const startY = Math.floor(bounds.top / step) * step;

        for (let x = startX; x < bounds.right; x += step) {
            this.ctx.moveTo(x, bounds.top);
            this.ctx.lineTo(x, bounds.bottom);
        }
        for (let y = startY; y < bounds.bottom; y += step) {
            this.ctx.moveTo(bounds.left, y);
            this.ctx.lineTo(bounds.right, y);
        }
        this.ctx.stroke();
    }

    /**
     * Draws a line between two points.
     * @param {Object} start - {x, y}
     * @param {Object} end - {x, y}
     * @param {string} color
     * @param {number} width
     * @param {Array<number>} [dash] - Line dash pattern
     */
    drawLine(start, end, color, width, dash = []) {
        if (!start || !end) return;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.setLineDash(dash);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    /**
     * Draws an arc.
     * @param {Object} center - {x, y}
     * @param {number} radius
     * @param {number} startAngle - Radians
     * @param {number} endAngle - Radians
     * @param {string} color
     * @param {number} width
     * @param {Array<number>} [dash] - Line dash pattern
     */
    drawArc(center, radius, startAngle, endAngle, color, width, dash = []) {
        if (!center || radius <= 0) return;
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, startAngle, endAngle);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.setLineDash(dash);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    /**
     * Draws a filled polygon.
     * @param {Array<Object>} points - Array of {x, y}
     * @param {string} fillColor
     */
    drawPolygon(points, fillColor) {
        if (points.length < 3) return;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
    }

    /**
     * Draws a filled circle.
     * @param {Object} pos - {x, y}
     * @param {number} radius
     * @param {string} color
     */
    drawCircle(pos, radius, color) {
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Draws text centered at position.
     * @param {string} text
     * @param {Object} pos - {x, y}
     * @param {string} color
     * @param {number} size - Font size in pixels
     * @param {string} [align] - 'center' | 'left' | 'right'
     */
    drawText(text, pos, color, size, align = 'center') {
        this.ctx.font = `${size}px sans-serif`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, pos.x, pos.y);
    }

    /**
     * Draws text with a stroke outline (for readability over lines).
     * @param {string} text
     * @param {Object} pos
     * @param {number} size
     * @param {string} fillColor
     * @param {string} strokeColor
     */
    drawTextOutlined(text, pos, size, fillColor, strokeColor) {
        this.ctx.font = `${size}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(text, pos.x, pos.y);
        this.ctx.fillStyle = fillColor;
        this.ctx.fillText(text, pos.x, pos.y);
    }
}
