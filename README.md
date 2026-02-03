# Wood Cut Planner

A professional-grade (this is a stretch), browser-based CAD tool for woodworking. Designed for 2D drafting with multi-side joinery modeling and seamless 3D assembly visualization.

![Screenshot Placeholder](screenshot.png)

## 🚀 Quick Start

This project is a static Single Page Application (SPA) with no build step required. It uses ES Modules.

### **Running Locally**
You just need a static file server.

**Using Python:**
```bash
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

**Using Node:**
```bash
npx serve .
```

---

## 🏗 Architecture

The project follows a **Modular, Data-Driven Architecture** designed for maintainability and clarity. It avoids heavy frameworks in favor of vanilla JS with a strong separation of concerns.

### **Core Systems**
*   **`src/core/state.js`**: The Single Source of Truth. Contains the `document` (persistent data) and `ui` (transient state).
*   **`src/core/model.js`**: Factory methods (`ShapeModel`, `TenonModel`) ensuring consistent data structures.
*   **`src/core/config.js`**: Centralized constants (colors, snap tolerances, default thickness).

### **Operations (Logic)**
Business logic is decomposed into specialized "Operation" modules.
*   **`drawing-op.js`**: Handling the pen tool, clicking points, and snapping.
*   **`dragging-op.js`**: Moving shapes and adjusting joinery.
*   **`joinery-op.js`**: Adding/removing tenons and cutouts.
*   **`threed-op.js`**: Handling 3D gizmo interactions and persistence.
*   **`project-op.js`**: Saving/loading projects via IndexedDB.

### **Systems (Input/Output)**
*   **`input.js`**: The central Event Bus. Routes raw DOM events (clicks, keys) to the appropriate Operation based on the current Mode.
*   **`view-controller.js`**: The main render loop orchestrator. Decides *what* to draw.

### **Renderers**
*   **`canvas-renderer.js`**: Wrapper for the HTML5 Canvas API (2D Overlay, Dimensions, UI).
*   **`webgl-renderer.js`**: Wrapper for Three.js (3D visualization, extrusions).

### **Utils**
*   **`geometry.js`**: Pure math functions. Vector projection, centroids, coordinate mapping.
*   **`boolean-ops.js`**: Polygon union/subtraction logic.

---

## 📐 Key Concepts for Contributors

### **1. Multi-Side Modeling**
A generic shape is just a 2D polygon. To model 3D joinery, we treat each edge of the polygon as a separate "Face".
*   **`FRONT`**: The main drawing view.
*   **`BACK`**: Mirrored horizontally (`x' = 2*cx - x`).
*   **`EDGE_N`**: A computed rectangle where `Width = Edge Length` and `Height = Thickness`.

Coordinate transformations for these views are centralized in `Geometry.getFaceOrigin()`.

### **2. The "Document" vs. "UI"**
*   **`STATE.document`**: Pure JSON data. This is what gets saved/loaded.
*   **`STATE.ui`**: Active tool, selection, zoom level, view mode. This is reset on reload.

### **3. 3D Persistence**
We do not save the 3D meshes. We save the **Transforms** (position/rotation offset) relative to the 2D shape's centroid.
*   `render3DScene()` rebuilds the mesh from the 2D profile + Thickness + Joinery data.
*   It then applies the saved `transform3D` offset.

---

## 🛠 Feature Roadmap
- [x] 2D Drafting (Lines, Snapping)
- [x] Multi-Face Joinery (Tenons, Mortises, Castle Joints)
- [x] Boolean Operations (Union/Subtract)
- [x] 3D Assembly & Visualization
- [x] Board Feet Calculator
- [ ] Printable Cut Lists
- [ ] Export to DXF/OBJ

## 👥 Authors
- **Gemini CLI**
- **mitchel wassler**

## 📄 License
MIT License. Free to use and modify.
