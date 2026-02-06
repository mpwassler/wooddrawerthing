export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    copy(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }
}

export class Matrix4 {
    makeRotationZ() {
        return this;
    }

    setPosition() {
        return this;
    }
}

export class Raycaster {
    setFromCamera() {}
    intersectObjects() {
        return [];
    }
}

export class Group {
    constructor() {
        this.children = [];
        this.userData = {};
        this.position = new Vector3();
        this.rotation = new Vector3();
    }

    add() {}
    traverse() {}
}

export class Scene {
    constructor() {
        this.background = null;
    }

    add() {}
    remove() {}
}

export class Color {
    constructor() {}
}

export class OrthographicCamera {
    constructor() {
        this.position = new Vector3();
    }

    updateProjectionMatrix() {}
}

export class PerspectiveCamera {
    constructor() {
        this.position = new Vector3();
        this.up = new Vector3();
    }

    lookAt() {}
    updateProjectionMatrix() {}
}

export class WebGLRenderer {
    constructor() {
        this.shadowMap = { enabled: false };
    }

    setSize() {}
    setPixelRatio() {}
    render() {}
}

export class AmbientLight {
    constructor() {}
}

export class DirectionalLight {
    constructor() {
        this.position = new Vector3();
    }
}

export class LineBasicMaterial {
    constructor() {}
}

export class MeshPhongMaterial {
    constructor() {}
}

export class MeshBasicMaterial {
    constructor() {}
}

export class BufferGeometry {
    setAttribute() {}
    dispose() {}
}

export class Float32BufferAttribute {
    constructor() {}
}

export class LineSegments {
    constructor() {
        this.position = new Vector3();
        this.scale = new Vector3(1, 1, 1);
    }
}

export class Line {
    constructor() {
        this.position = new Vector3();
        this.scale = new Vector3(1, 1, 1);
    }
}

export class Shape {
    constructor() {
        this.holes = [];
    }

    moveTo() {}
    lineTo() {}
}

export class ShapeGeometry {
    constructor() {}
}

export class Mesh {
    constructor() {
        this.position = new Vector3();
        this.rotation = new Vector3();
        this.scale = new Vector3(1, 1, 1);
        this.userData = {};
    }
}

export class GridHelper {
    constructor() {
        this.rotation = new Vector3();
    }
}

export class Box3 {
    setFromObject() {
        return this;
    }

    union() {
        return this;
    }

    getCenter(target = new Vector3()) {
        return target;
    }

    getSize(target = new Vector3()) {
        return target;
    }
}

export class ExtrudeGeometry {
    constructor() {}
}

export class Path {
    moveTo() {}
    lineTo() {}
}

export const DoubleSide = 0;
