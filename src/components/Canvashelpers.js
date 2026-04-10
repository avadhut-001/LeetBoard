export const screenToCanvas = (sx, sy, offset, zoom) => ({
  x: (sx - offset.x) / zoom,
  y: (sy - offset.y) / zoom,
});

// Handle indices: 0=TL 1=TC 2=TR 3=ML 4=MR 5=BL 6=BC 7=BR
export const HANDLE_SIZE = 8; // canvas units

export const getHandles = (shape) => {
  const { x, y, w, h } = shape;
  return [
    { x: x,         y: y         }, // 0 TL
    { x: x + w / 2, y: y         }, // 1 TC
    { x: x + w,     y: y         }, // 2 TR
    { x: x,         y: y + h / 2 }, // 3 ML
    { x: x + w,     y: y + h / 2 }, // 4 MR
    { x: x,         y: y + h     }, // 5 BL
    { x: x + w / 2, y: y + h     }, // 6 BC
    { x: x + w,     y: y + h     }, // 7 BR
  ];
};

export const hitHandle = (shape, pos, zoom) => {
  const hs = HANDLE_SIZE / zoom;
  const handles = getHandles(shape);
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    if (Math.abs(pos.x - h.x) <= hs && Math.abs(pos.y - h.y) <= hs) return i;
  }
  return -1;
};

export const hitImage = (shape, pos) =>
  pos.x >= shape.x && pos.x <= shape.x + shape.w &&
  pos.y >= shape.y && pos.y <= shape.y + shape.h;

export const HANDLE_CURSORS = [
  "nw-resize", "n-resize", "ne-resize",
  "w-resize",  "e-resize",
  "sw-resize", "s-resize", "se-resize",
];

export const applyResize = (orig, handleIdx, dx, dy) => {
  let { x, y, w, h } = orig;
  switch (handleIdx) {
    case 0: x += dx; y += dy; w -= dx; h -= dy; break; // TL
    case 1: y += dy; h -= dy;                   break; // TC
    case 2: y += dy; w += dx; h -= dy;          break; // TR
    case 3: x += dx; w -= dx;                   break; // ML
    case 4: w += dx;                             break; // MR
    case 5: x += dx; w -= dx; h += dy;          break; // BL
    case 6: h += dy;                             break; // BC
    case 7: w += dx; h += dy;                   break; // BR
    default: break;
  }
  // keep minimum size
  if (w < 10) { if ([0, 3, 5].includes(handleIdx)) x = orig.x + orig.w - 10; w = 10; }
  if (h < 10) { if ([0, 1, 2].includes(handleIdx)) y = orig.y + orig.h - 10; h = 10; }
  return { x, y, w, h };
};