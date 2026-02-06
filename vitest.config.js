import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: [
            {
                find: 'three',
                replacement: path.resolve(__dirname, 'web/src/test/three-stub.js')
            },
            {
                find: 'three/addons/controls/OrbitControls.js',
                replacement: path.resolve(__dirname, 'web/src/test/three-orbit-controls-stub.js')
            },
            {
                find: 'three/addons/controls/TransformControls.js',
                replacement: path.resolve(__dirname, 'web/src/test/three-transform-controls-stub.js')
            }
        ]
    }
});
