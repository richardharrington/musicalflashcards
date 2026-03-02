const SVG_NS = 'http://www.w3.org/2000/svg';

const SELF_CLOSING_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const camelToKebab = (str: string): string =>
  str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export class FakeSVGElement {
  nodeName: string;
  attributes: Map<string, string> = new Map();
  children: FakeSVGElement[] = [];
  parentNode: FakeSVGElement | null = null;
  textContent: string = '';
  style: Record<string, string> = {};

  constructor(tagName: string) {
    this.nodeName = tagName;
  }

  get lastChild(): FakeSVGElement | null {
    return this.children.length > 0
      ? this.children[this.children.length - 1]
      : null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  setAttributeNS(_ns: string | null, name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeSVGElement): FakeSVGElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeSVGElement): FakeSVGElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  getBBox(): { x: number; y: number; width: number; height: number } {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function createFakeDocument() {
  return {
    createElementNS(_ns: string, tagName: string): FakeSVGElement {
      return new FakeSVGElement(tagName);
    },
    createElement(tagName: string): FakeSVGElement {
      return new FakeSVGElement(tagName);
    },
    getElementById(_id: string): null {
      return null;
    },
  };
}

export function createFakeContainer(): FakeSVGElement {
  return new FakeSVGElement('div');
}

/**
 * Temporarily set up globalThis.document so VexFlow's SVGContext
 * can call document.createElementNS. Call teardownFakeDocument()
 * when done rendering.
 */
export function setupFakeDocument(): void {
  (globalThis as any).document = createFakeDocument();
}

export function teardownFakeDocument(): void {
  delete (globalThis as any).document;
}

function serializeElement(el: FakeSVGElement): string {
  const tag = el.nodeName;

  let attrs = '';
  for (const [key, value] of el.attributes) {
    if (key === 'style') continue;
    attrs += ` ${key}="${escapeXml(value)}"`;
  }

  const attrStyle = el.attributes.get('style') ?? '';
  const objStyleParts = Object.entries(el.style)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${camelToKebab(k)}:${v}`);
  const combinedStyle = [attrStyle, ...objStyleParts].filter(Boolean).join(';');
  if (combinedStyle) {
    attrs += ` style="${escapeXml(combinedStyle)}"`;
  }

  const hasChildren = el.children.length > 0;
  const hasText = el.textContent !== '';

  if (!hasChildren && !hasText && SELF_CLOSING_TAGS.has(tag)) {
    return `<${tag}${attrs}/>`;
  }

  if (!hasChildren && hasText) {
    return `<${tag}${attrs}>${escapeXml(el.textContent)}</${tag}>`;
  }

  const inner = el.children.map(serializeElement).join('');
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/**
 * Serialize the container's SVG child tree to an SVG string
 * suitable for react-native-svg's SvgXml.
 */
export function toSVGString(container: FakeSVGElement): string {
  const svgEl = container.children.find((c) => c.nodeName === 'svg');
  if (!svgEl) return '';

  if (!svgEl.attributes.has('xmlns')) {
    svgEl.attributes.set('xmlns', SVG_NS);
  }
  return serializeElement(svgEl);
}
