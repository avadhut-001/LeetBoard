import { drawShape } from "./Drawshape";
import { drawSelection } from "./Drawselection";

export const redrawAll = (canvas, ctx, shapes, offset, zoom, darkMode, selectedIdx) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (darkMode) { ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.restore();

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);
  shapes.forEach((s, i) => {
    drawShape(ctx, s);
    if (s.type === "image" && i === selectedIdx) drawSelection(ctx, s, zoom);
  });
  ctx.restore();
};