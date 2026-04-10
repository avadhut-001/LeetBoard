import { imageCache } from "./Imagecache";

export const drawShape = (ctx, shape) => {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.lineWidth ?? 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";

  switch (shape.type) {
    case "rect":
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      break;
    case "circle": {
      const r = Math.hypot(shape.w, shape.h);
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "diamond": {
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, shape.y);
      ctx.lineTo(shape.x + shape.w, cy);
      ctx.lineTo(cx, shape.y + shape.h);
      ctx.lineTo(shape.x, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "line":
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
      ctx.stroke();
      break;
    case "arrow": {
      const ex = shape.x + shape.w, ey = shape.y + shape.h;
      const angle = Math.atan2(shape.h, shape.w);
      const hl = 14;
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - hl * Math.cos(angle - Math.PI / 6), ey - hl * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - hl * Math.cos(angle + Math.PI / 6), ey - hl * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case "pencil":
      if (!shape.points || shape.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      break;
    case "eraser":
      if (!shape.points || shape.points.length < 2) break;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = shape.eraserSize ?? 20;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
      break;
    case "image":
      if (imageCache.has(shape.src))
        ctx.drawImage(imageCache.get(shape.src), shape.x, shape.y, shape.w, shape.h);
      break;
    case "text": {
      const fontSize = shape.fontSize ?? 18;

      ctx.fillStyle = shape.color;
      ctx.font = `${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textBaseline = "top";

      const lines = (shape.text ?? "").split("\n");

      let maxWidth = 0;

      lines.forEach((line, i) => {
        const y = shape.y + i * fontSize * 1.4;
        ctx.fillText(line, shape.x, y);

        // 🔥 calculate width for selection
        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) {
          maxWidth = metrics.width;
        }
      });

      // 🔥 SAVE WIDTH & HEIGHT for interaction
      shape.width = maxWidth;
      shape.height = lines.length * fontSize * 1.4;

      break;
    }
    case "code": {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#6965db";
      ctx.lineWidth = 2;
      ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      ctx.fillStyle = "#000";
      ctx.font = "14px sans-serif";
      const text = shape.time || "Code";
      ctx.fillText(text, shape.x + 8, shape.y + 20);
      break;
    }
    default: break;
  }
  ctx.restore();
};