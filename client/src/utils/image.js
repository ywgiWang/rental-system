function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function compressImage(file, maxSize = 1920, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  let url;
  try {
    url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    if (scale >= 1 && file.type !== 'image/png') return file;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
