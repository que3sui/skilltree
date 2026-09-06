/**
 * 图谱分享卡导出：把当前 SVG 视图渲染成带题头信息的 PNG。
 * 原理：克隆 SVG → 把关键类的计算样式内联（序列化不带外链 CSS）→
 * data URL → canvas 绘制（2x 清晰度）→ 题头/角标 → 触发下载。
 * 仅支持 tree/grid（SVG 视图）；deck 是 HTML 3D，不适用。
 */

const INLINE_CLASSES = [
  "branch-name", "branch-count", "edge", "edge-active", "edge-weak", "edge-focus", "edge-faded",
  "node-box", "node-name", "node-knockout", "pip", "pip-on", "pip-wait",
  "hex-base", "hex-lit", "hex-blocked", "hex-digit", "hex",
];

function inlineStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = svg.querySelectorAll<SVGElement>("*");
  const clones = clone.querySelectorAll<SVGElement>("*");
  originals.forEach((orig, i) => {
    const cls = orig.getAttribute("class") ?? "";
    if (!INLINE_CLASSES.some((c) => cls.split(/\s+/).includes(c))) return;
    const cs = getComputedStyle(orig);
    const target = clones[i] as SVGElement | undefined;
    if (!target) return;
    const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-weight", "font-family", "text-anchor", "letter-spacing"];
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v) target.style.setProperty(p, v);
    }
  });
  return clone;
}

export interface CardMeta {
  title: string;
  sub: string; // provider · 分钟
  lit: number;
  total: number;
  fingerprint: string; // 证据指纹（截短）
}

export async function exportGraphPng(svg: SVGSVGElement, meta: CardMeta): Promise<void> {
  const clone = inlineStyles(svg);
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth;
  const h = vb && vb.height ? vb.height : svg.clientHeight;
  const HEAD = 92;
  const FOOT = 46;
  const SCALE = 2;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("图谱序列化失败"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w * SCALE;
  canvas.height = (h + HEAD + FOOT) * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 不可用");
  ctx.scale(SCALE, SCALE);
  // 题头
  const styles = getComputedStyle(document.body);
  ctx.fillStyle = styles.backgroundColor;
  ctx.fillRect(0, 0, w, HEAD + FOOT + h);
  ctx.fillStyle = "#004098";
  ctx.font = "600 30px 'Microsoft YaHei', sans-serif";
  ctx.fillText(`建木 · ${meta.title}`, 24, 46);
  ctx.font = "400 16px 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#4b5568";
  ctx.fillText(`${meta.sub} · 点亮 ${meta.lit}/${meta.total} · 标准公开 · 结论可申诉`, 24, 76);
  // 图谱
  ctx.drawImage(img, 0, HEAD, w, h);
  // 角标：证据指纹
  ctx.font = "400 13px Consolas, monospace";
  ctx.fillStyle = "#8b98b0";
  ctx.fillText(`evidence ${meta.fingerprint}`, 24, HEAD + h + 30);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG 编码失败");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `建木-${meta.title}-${meta.lit}of${meta.total}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
