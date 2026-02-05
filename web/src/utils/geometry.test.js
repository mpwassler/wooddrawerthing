import { describe, it, expect } from 'vitest';
import { Geometry } from './geometry.js';
import { CONFIG } from '../core/config.js';

describe('Geometry Utils', () => {
    
    describe('dist', () => {
        it('calculates distance between two points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 3, y: 4 };
            expect(Geometry.dist(p1, p2)).toBe(5);
        });
    });

    describe('formatInches', () => {
        it('formats integers correctly', () => {
            expect(Geometry.formatInches(12)).toBe('12"');
        });

        it('formats simple fractions', () => {
            expect(Geometry.formatInches(10.5)).toBe('10 1/2"');
        });

        it('formats complex fractions with GCD', () => {
            // 0.25 = 1/4
            expect(Geometry.formatInches(5.25)).toBe('5 1/4"');
            // 0.125 = 1/8
            expect(Geometry.formatInches(0.125)).toBe('0 1/8"');
        });

        it('handles small numbers (0)', () => {
            expect(Geometry.formatInches(0)).toBe('0"');
        });
    });

    describe('parseMeasurement', () => {
        it('parses feet and inches (e.g. 1\' 6\"', () => {
            expect(Geometry.parseMeasurement("1' 6\"")).toBe(18);
        });

        it('parses just inches (e.g. 24\"', () => {
            expect(Geometry.parseMeasurement('24"')).toBe(24);
        });

        it('parses fractions (e.g. 1/2\"', () => {
            expect(Geometry.parseMeasurement('1/2"')).toBe(0.5);
        });

        it('parses mixed inches (e.g. 1 1/2")', () => {
            expect(Geometry.parseMeasurement('1 1/2"')).toBe(1.5);
        });

        it('parses feet, inches and fractions (e.g. 1\' 2 1/2")', () => {
            // 12 + 2 + 0.5 = 14.5
            expect(Geometry.parseMeasurement("1' 2 1/2\"")).toBe(14.5);
        });
    });

    describe('Coordinate Transforms', () => {
        const view = { pan: { x: 100, y: 50 }, zoom: 2 };

        it('converts screen to world', () => {
            // Screen (100, 50) -> minus pan (0, 0) -> div zoom -> World (0, 0)
            const screen = { x: 100, y: 50 };
            const world = Geometry.screenToWorld(screen, view);
            expect(world).toEqual({ x: 0, y: 0 });
        });

        it('converts world to screen', () => {
            // World (10, 10) -> times zoom (20, 20) -> plus pan -> Screen (120, 70)
            const world = { x: 10, y: 10 };
            const screen = Geometry.worldToScreen(world, view);
            expect(screen).toEqual({ x: 120, y: 70 });
        });
    });
});
