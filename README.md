# Untitled Sekai Live2D Viewer

A small Next.js viewer for browsing and previewing Project Sekai Live2D models.

## Features

- Browse available models from a local asset server
- Load and preview Live2D models in the browser
- Play motions and facials
- Download the selected model as a ZIP
- Export motions into `motions/*.motion3.json`
- Capture screenshots from the viewer

## Tech Stack

- Next.js 16
- React 19
- PixiJS 8
- `untitled-pixi-live2d-engine`
- `fflate`

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

## Environment

The app reads the asset server URL from `NEXT_PUBLIC_SERVER_URL`.

If it is not set, it defaults to:

```text
http://127.0.0.1:8080
```

Example:

```bash
NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:8080 pnpm dev
```

## ZIP Export

When downloading a model as ZIP:

- the `.model3.json` file is placed at the ZIP root
- model assets are included with normalized relative paths
- motions are exported into `motions/*.motion3.json`
- the exported `model3.json` is rewritten to register those motions

## Notes

This project depends on a compatible local model server that exposes:

- `/model_list.json`
- `/model/<path>/<file>`
- `/motion/<path>/...`
