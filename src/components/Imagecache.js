export const imageCache = new Map();

export const loadImage = (src, onReady) => {
  if (imageCache.has(src)) { onReady(imageCache.get(src)); return; }
  const img = new Image();
  img.onload = () => { imageCache.set(src, img); onReady(img); };
  img.src = src;
};