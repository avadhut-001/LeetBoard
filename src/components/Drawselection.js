import { HANDLE_SIZE, getHandles } from "./Canvashelpers";

export const drawSelection = (ctx, shape, zoom) => {
  ctx.save();
  ctx.strokeStyle = "#6965db";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
  ctx.setLineDash([]);

  const hs = HANDLE_SIZE / zoom;
  getHandles(shape).forEach(h => {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#6965db";
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
  });
  ctx.restore();
};