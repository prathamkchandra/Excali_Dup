# Workboard

An Excalidraw-inspired infinite drawing and diagramming application built with **Next.js, React, TypeScript, and HTML5 Canvas**.

Workboard provides an interactive workspace where users can draw, select, move, resize, erase, and manage different types of shapes on an effectively infinite canvas.

---

## ✨ Features

### 🎨 Drawing Tools

- ✏️ Pencil / Freehand drawing
- ▭ Rectangle
- ⬜ Square
- ◯ Circle
- ─ Straight Line
- ➡️ Arrow
- 🖱️ Select
- 🧹 Eraser

### 🛠️ Editing

- Select individual shapes
- Move shapes by dragging
- Resize shapes using resize handles
- Resize lines and arrows using start/end handles
- Hit detection for selecting shapes
- Click-to-erase objects
- Move freehand pencil strokes
- Object-based editing instead of pixel-based editing

### ♾️ Infinite Canvas

Workboard uses a **camera-based infinite canvas architecture**.

Instead of continuously increasing the size of the HTML5 canvas, the application keeps a fixed viewport and moves a virtual camera through an unlimited drawing world.

```text
                    INFINITE WORLD

        ○ Circle

                    ▭ Rectangle


                             → Arrow


                ┌────────────────────┐
                │                    │
                │      CAMERA        │
                │      VIEW          │
                │                    │
                └────────────────────┘
```

This allows users to move around the drawing space without requiring an extremely large HTML canvas.

---

## 📷 Camera System

The application uses a camera to determine which portion of the world is visible.

```ts
type Camera = {
  x: number;
  y: number;
};
```

The camera position represents the current viewport location in world coordinates.

For a simple translation:

```ts
screenX = worldX - camera.x;
screenY = worldY - camera.y;
```

The shape itself stays at its original world position while the camera changes.

### Camera Controls

- Drag empty canvas → Pan the camera
- Hold `Space` + drag → Force camera pan
- Middle mouse drag → Pan the camera
- Two-finger touch → Pan the camera

This provides a clean separation between:

```text
Moving a Shape
        vs.
Moving the View
```

---

## 🌍 World Coordinates vs Screen Coordinates

Workboard separates drawing coordinates into two systems.

### World Coordinates

The permanent position of an object in the drawing world.

Example:

```ts
{
  x: 1000,
  y: 500
}
```

### Screen Coordinates

The position at which the object appears inside the browser viewport.

The application converts between the two coordinate systems.

```text
World Coordinates
        │
        ▼
Camera Transformation
        │
        ▼
Screen Coordinates
        │
        ▼
HTML5 Canvas
```

This architecture makes panning and future camera features much easier to implement.

---

# 🧱 Architecture

Workboard separates application state, user interaction, geometry calculations, rendering, and persistence.

```text
Workboard
│
├── UI
│   ├── Toolbar
│   ├── BottomBar
│   └── DrawCanvas
│
├── Application State
│   ├── Shapes
│   ├── Current Tool
│   ├── Selection
│   ├── Camera
│   └── History
│
├── Interaction
│   ├── Mouse Events
│   ├── Touch Events
│   ├── Keyboard Events
│   └── Wheel Events
│
├── Geometry
│   ├── Hit Testing
│   ├── Resize Handles
│   ├── Shape Resizing
│   └── Shape Translation
│
├── Rendering
│   ├── Background
│   ├── Grid
│   ├── Shapes
│   ├── Selection
│   └── Cursor
│
├── Camera
│   ├── Camera State
│   ├── World Coordinates
│   └── Screen Coordinates
│
└── Storage
    ├── IndexedDB
    └── localStorage
```

---

# 🧩 Shape-Based Architecture

Workboard does not use the canvas pixels as the application's source of truth.

Instead, every drawing object is represented as structured data.

For example, a rectangle can be represented as:

```ts
{
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 100
}
```

A line:

```ts
{
  type: "line",
  startX: 100,
  startY: 100,
  endX: 300,
  endY: 200
}
```

An arrow:

```ts
{
  type: "arrow",
  startX: 100,
  startY: 100,
  endX: 300,
  endY: 200
}
```

A pencil stroke:

```ts
{
  type: "pencil",
  points: [
    { x: 100, y: 100 },
    { x: 110, y: 105 },
    { x: 120, y: 115 }
  ]
}
```

The data is then passed to the rendering system.

```text
Shape Data
    │
    ▼
Geometry / Camera
    │
    ▼
Renderer
    │
    ▼
Canvas API
    │
    ▼
Pixels on Screen
```

This design makes selection, movement, resizing, undo/redo, and persistence possible.

---

# 🎯 Shape Hit Testing

HTML5 Canvas does not automatically know which application object the user clicked.

Workboard therefore performs its own hit testing.

Shapes are checked from the top-most object backwards so that the object visually on top can be selected first.

Conceptually:

```ts
for (let i = shapes.length - 1; i >= 0; i--) {
  if (shapeContainsPoint(shapes[i], x, y)) {
    return i;
  }
}
```

Hit testing is used for:

- Selecting shapes
- Moving shapes
- Erasing shapes
- Detecting resize handles
- Determining the object under the cursor

---

# 🖱️ Shape Selection

When the Select tool is active, the application checks whether the pointer is over a shape.

The selection flow is approximately:

```text
Pointer Down
     │
     ▼
Convert Screen → World
     │
     ▼
Hit Test
     │
     ├── Shape Found
     │      │
     │      ▼
     │   Select Shape
     │
     └── No Shape
            │
            ▼
         Pan Canvas
```

This allows selection and camera movement to coexist naturally.

---

# ✋ Shape Dragging

When a selected shape is dragged, Workboard calculates the pointer offset relative to the shape.

Example:

```text
Mouse Position = (150, 130)
Shape Position = (100, 100)

Offset = (50, 30)
```

When the pointer moves:

```text
New Shape X = Mouse X - Offset X
New Shape Y = Mouse Y - Offset Y
```

This prevents the shape from jumping when the drag starts.

The general flow is:

```text
Pointer Movement
      │
      ▼
Calculate New Position
      │
      ▼
Update Shape Data
      │
      ▼
Schedule Render
      │
      ▼
Canvas Redraw
```

---

# 📐 Shape Resizing

Workboard supports resize handles for editable shapes.

### Rectangle / Square

```text
tl ───────── tr
│             │
│    Shape    │
│             │
bl ───────── br
```

### Line / Arrow

```text
●────────────────●
Start            End
```

The resize system uses a typed handle identifier:

```ts
type ResizeHandleId =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "start"
  | "end";
```

This provides type safety when working with different shape types.

---

# 🧹 Eraser

Workboard uses an **object-based click-to-erase** approach.

The eraser does not continuously paint over pixels.

Instead:

```text
Click
  │
  ▼
Screen → World Conversion
  │
  ▼
Hit Testing
  │
  ▼
Find Shape
  │
  ▼
Remove Shape
  │
  ▼
Redraw Canvas
```

This makes the eraser compatible with the application's shape-based architecture.

---

# ✏️ Pencil / Freehand Drawing

The Pencil tool collects pointer positions while the user draws.

Example:

```ts
{
  type: "pencil",
  points: [
    { x: 10, y: 20 },
    { x: 15, y: 25 },
    { x: 20, y: 30 }
  ]
}
```

The renderer connects these points to create the freehand stroke.

```text
Pointer
   │
   ▼
Collect Points
   │
   ▼
Create Pencil Shape
   │
   ▼
Store Shape
   │
   ▼
Render Stroke
```

Because the points are stored as data, pencil strokes can also be moved and persisted.

---

# ➖ Lines and ➡️ Arrows

Workboard supports straight lines using start and end coordinates.

```ts
{
  type: "line",
  startX: 100,
  startY: 100,
  endX: 300,
  endY: 200
}
```

Arrows use the same endpoint model while additionally rendering an arrowhead.

```ts
{
  type: "arrow",
  startX: 100,
  startY: 100,
  endX: 300,
  endY: 200
}
```

The arrowhead direction is calculated from the line angle.

Conceptually:

```ts
const angle = Math.atan2(
  endY - startY,
  endX - startX
);
```

The endpoint architecture also makes line and arrow resizing straightforward.

---

# 🎨 Canvas Rendering

Workboard uses the HTML5 Canvas 2D API.

Common APIs include:

```ts
ctx.beginPath();
ctx.moveTo();
ctx.lineTo();
ctx.stroke();

ctx.strokeRect();

ctx.arc();

ctx.clearRect();

ctx.save();
ctx.restore();
```

The renderer is responsible for translating the application's structured shape data into visible pixels.

The rendering pipeline is roughly:

```text
Clear Canvas
     │
     ▼
Draw Background
     │
     ▼
Draw Grid
     │
     ▼
Draw Shapes
     │
     ▼
Draw Selection
     │
     ▼
Draw Tool Cursor
```

---

# ⚡ RequestAnimationFrame Rendering

Workboard uses `requestAnimationFrame()` to coordinate rendering updates.

Instead of trying to redraw the canvas independently for every small interaction event, render requests are scheduled and processed through the browser's animation loop.

```text
Mouse / Touch Event
        │
        ▼
Update Drawing State
        │
        ▼
scheduleRender()
        │
        ▼
requestAnimationFrame()
        │
        ▼
Render
```

This is especially useful for continuous interactions such as:

- Freehand drawing
- Shape dragging
- Shape resizing
- Camera panning

---

# ↩️ Undo / Redo

Workboard maintains drawing history using shape snapshots.

Before a modifying action, the current shape state can be stored:

```ts
history.current.push(
  structuredClone(shapesRef.current)
);
```

Undo restores a previous snapshot.

Redo restores a state from the redo stack.

Conceptually:

```text
Current State
     │
     ▼
History Stack

Undo
  ↓
Previous State

Redo
  ↓
Redo Stack
```

Because the application stores structured shape data, undo/redo can operate on objects instead of canvas pixels.

---

# 💾 Data Persistence

Workboard uses browser storage to persist application data.

The storage architecture separates responsibilities between **IndexedDB** and **localStorage**.

```text
Workboard
│
├── localStorage
│   └── activeDrawingId
│
└── IndexedDB
    ├── Drawing Data
    ├── Shapes
    ├── Camera
    ├── Zoom State
    └── Metadata
```

---

# 🗄️ IndexedDB

IndexedDB is used as the primary persistent storage for drawing data.

The project uses **Dexie** as a wrapper around the browser's native IndexedDB API.

A drawing can contain:

```ts
type Drawing = {
  id: string;
  name: string;
  shapes: Shape[];
  camera: Camera;
  zoom: number;
  createdAt: number;
  updatedAt: number;
};
```

IndexedDB is useful here because Workboard may need to store:

- Large shape collections
- Pencil point arrays
- Multiple drawings
- Drawing metadata
- Camera information
- Future binary/image data

---

# 💡 localStorage

localStorage is used for small pieces of application state and preferences.

For example:

```text
workboard:activeDrawingId
```

The active drawing ID is stored in localStorage while the actual drawing remains in IndexedDB.

This separation keeps localStorage lightweight.

---

# 🔄 Persistence Lifecycle

When the application starts:

```text
Application Starts
       │
       ▼
Read activeDrawingId
       │
       ▼
Load Drawing from IndexedDB
       │
       ▼
Restore Shapes
       │
       ▼
Restore Camera
       │
       ▼
Render Canvas
```

When drawing data changes:

```text
Shape Change
     │
     ▼
Update Drawing State
     │
     ▼
Save Drawing
     │
     ▼
IndexedDB
```

---

# ⚛️ React and useRef

Workboard uses React `useRef` for values that need to persist between renders without forcing a React component re-render whenever they change.

For example:

```ts
const shapesRef = useRef<Shape[]>([]);
```

```ts
const cameraRef = useRef<Camera>({
  x: 0,
  y: 0
});
```

```ts
const selectedShape = useRef<number | null>(null);
```

```ts
const currentShape = useRef<Shape | null>(null);
```

For example:

```ts
useRef<Camera>({
  x: 0,
  y: 0
});
```

means:

- `useRef` creates a React ref
- `<Camera>` tells TypeScript what type the ref stores
- `{ x: 0, y: 0 }` is the initial value
- The current value is accessed through:

```ts
cameraRef.current
```

---

# 🧠 Why useRef Is Useful

Drawing applications generate many high-frequency events:

```text
mousemove
touchmove
drag
resize
pan
```

Updating React state for every movement can cause unnecessary component rendering.

Using refs allows frequently changing internal values to be updated directly.

Example:

```ts
cameraRef.current.x += deltaX;
cameraRef.current.y += deltaY;
```

The application can then explicitly schedule canvas rendering.

---

# 🎛️ Tool System

Workboard uses a typed tool architecture.

Available tools include:

```text
pencil
rectangle
square
circle
line
arrow
select
eraser
```

The selected tool determines how pointer events are interpreted.

For example:

```text
Pencil + Drag
    → Draw

Rectangle + Drag
    → Create Rectangle

Select + Drag on Shape
    → Move Shape

Select + Drag Resize Handle
    → Resize Shape

Select + Drag Empty Canvas
    → Pan Camera

Eraser + Click
    → Delete Shape
```

---

# 🤏 Touch Support

Workboard includes touch interaction support for tablets and mobile devices.

Supported interactions include:

- Touch drawing
- Touch selection
- Touch shape movement
- Two-finger camera panning
- Responsive controls

The canvas uses:

```css
touch-action: none;
```

so the application can manage pointer and touch interactions itself.

---

# 📱 Responsive Design

Workboard is designed to work across:

- Desktop
- Laptop
- Tablet
- Mobile

The interface is designed to adapt to different viewport sizes.

Responsive considerations include:

- Flexible toolbar layout
- Mobile-friendly controls
- Horizontal scrolling for toolbar content when necessary
- Responsive bottom controls
- Touch-friendly targets
- Safe-area support
- Viewport-based canvas sizing
- Prevention of unwanted page scrolling

The canvas is intended to occupy the available viewport rather than relying on a fixed desktop-only size.

---

# 🖱️ Custom Cursors

Workboard provides different cursors based on the currently active tool.

Examples include:

```text
Pencil  → Custom pencil cursor
Eraser  → Circular eraser cursor
Select  → Selection / grab cursor
Resize  → Directional resize cursor
Shapes  → Crosshair cursor
Pan     → Grab / grabbing cursor
```

This gives immediate visual feedback about the current interaction mode.

---

# 📁 Project Structure

A simplified project structure is:

```text
frontend/
│
├── app/
│   │
│   ├── components/
│   │   ├── DrawCanvas.tsx
│   │   ├── Toolbar.tsx
│   │   └── BottomBar.tsx
│   │
│   ├── types/
│   │   ├── Shape.ts
│   │   ├── Tool.ts
│   │   └── Drawing.ts
│   │
│   ├── utils/
│   │   ├── camera.ts
│   │   ├── coordinates.ts
│   │   ├── canvas.ts
│   │   ├── draw.ts
│   │   ├── geometry.ts
│   │   └── shapes.ts
│   │
│   └── storage/
│       ├── indexedDb.ts
│       ├── localStorage.ts
│       └── drawingStorage.ts
│
├── public/
│
├── package.json
│
└── README.md
```

The exact structure may evolve as the project grows.

---

# 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js | Application framework |
| React | UI and component architecture |
| TypeScript | Static typing |
| HTML5 Canvas | Drawing and rendering |
| Dexie | IndexedDB wrapper |
| IndexedDB | Persistent drawing storage |
| localStorage | Lightweight browser storage |
| CSS | Responsive UI |

---

# 🚀 Getting Started

## 1. Clone the repository

```bash
git clone <your-repository-url>
```

## 2. Navigate to the project

```bash
cd Workboard
```

## 3. Install dependencies

```bash
npm install
```

## 4. Start the development server

```bash
npm run dev
```

Open the application in your browser:

```text
http://localhost:3000
```

---

# 🧪 Development Workflow

The main drawing workflow follows this architecture:

```text
User Input
    │
    ▼
Pointer / Keyboard Event
    │
    ▼
Tool Detection
    │
    ▼
Screen → World Conversion
    │
    ▼
Geometry / Shape Operation
    │
    ▼
Update Shape Data
    │
    ▼
Schedule Render
    │
    ▼
Canvas Rendering
```

Persistence follows a separate path:

```text
Shape Update
     │
     ▼
Drawing State
     │
     ▼
Storage Layer
     │
     ▼
IndexedDB
```

---

# ⌨️ Keyboard Shortcuts

Current keyboard interactions include:

| Shortcut | Action |
|---|---|
| `Space` + Drag | Pan camera |
| `Ctrl` / `Cmd` + `Z` | Undo |
| `Shift` + `Z` | Redo |
| `Ctrl` / `Cmd` + `Y` | Redo |

Additional shortcuts can be added as the application grows.

---

# 🧠 Design Philosophy

Workboard follows several important architectural principles.

## 1. Data is the source of truth

Shapes are stored as structured JavaScript/TypeScript objects.

The canvas is a rendering surface rather than the application's database.

---

## 2. World and screen coordinates are separate

Shapes live in world space.

The camera determines where those objects appear on the user's screen.

---

## 3. Rendering is explicit

The canvas is redrawn from the current application state.

This makes rendering predictable and allows the camera and selection systems to work independently.

---

## 4. Interaction is modular

Different interaction modes handle:

- Drawing
- Selection
- Dragging
- Resizing
- Panning
- Erasing

This keeps the event-handling logic easier to maintain as the application grows.

---

## 5. Persistence is separated from rendering

The canvas is responsible for displaying data.

IndexedDB is responsible for persisting data.

This separation allows the drawing to be restored independently of the rendering layer.

---

# 🔥 Current Implementation Status

### Core Canvas

- [x] HTML5 Canvas
- [x] Canvas initialization
- [x] Responsive canvas sizing
- [x] Device pixel ratio handling
- [x] Background rendering
- [x] Grid rendering

### Drawing

- [x] Pencil / Freehand
- [x] Rectangle
- [x] Square
- [x] Circle
- [x] Straight Line
- [x] Arrow

### Editing

- [x] Select
- [x] Shape hit testing
- [x] Shape dragging
- [x] Shape resizing
- [x] Line/arrow endpoint resizing
- [x] Click-to-erase
- [x] Pencil stroke movement

### Infinite Canvas

- [x] Camera system
- [x] Camera panning
- [x] World coordinates
- [x] Screen coordinates
- [x] Screen-to-world conversion
- [x] World-to-screen rendering

### Interaction

- [x] Mouse support
- [x] Keyboard interaction
- [x] Touch interaction foundation
- [x] Two-finger camera panning
- [x] Custom cursors

### History

- [x] Undo
- [x] Redo

### Persistence

- [x] IndexedDB architecture
- [x] Dexie integration
- [x] Drawing CRUD operations
- [x] localStorage active drawing ID
- [x] Drawing restoration architecture

### Responsive UI

- [x] Desktop support
- [x] Laptop support
- [x] Tablet support
- [x] Mobile support foundation

---

# 🚧 Future Improvements

Planned improvements include:

- [ ] Advanced zoom controls
- [ ] Zoom centered around cursor
- [ ] Better angle snapping
- [ ] Text tool
- [ ] Image insertion
- [ ] PNG export
- [ ] SVG export
- [ ] Import/export drawing files
- [ ] Multiple drawing/document management
- [ ] Improved autosave strategy
- [ ] More advanced shape editing
- [ ] Cloud persistence
- [ ] Real-time collaboration
- [ ] Additional diagramming tools
- [ ] Improved mobile drawing experience

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

A typical workflow is:

```bash
git checkout -b feature/your-feature
```

Make your changes, test them locally, commit your changes, and open a pull request.

---

# 📄 License

This project is currently available under the license specified in the repository.

Add a license file such as `MIT` when the project is ready for public distribution.

---

# 👨‍💻 Author

**Pratham**

### Workboard

An interactive browser-based drawing and diagramming application inspired by modern infinite-canvas tools.

---

## ⭐ Project Goal

The long-term goal of Workboard is to provide a lightweight, extensible, browser-based drawing environment with the flexibility of an infinite canvas and the simplicity of a diagramming tool.

The architecture is intentionally designed around:

```text
React
  +
TypeScript
  +
HTML5 Canvas
  +
Shape Model
  +
Camera System
  +
Geometry Engine
  +
Persistent Storage
```

making it possible to continue adding advanced drawing and diagramming capabilities without rebuilding the core rendering system.
