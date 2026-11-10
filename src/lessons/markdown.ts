/** Minimal, safe Markdown -> DOM (headings, lists, paragraphs, **bold**, `code`). No HTML is ever parsed. */
function inline(text: string): Node[] {
  const out: Node[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(document.createTextNode(text.slice(last, i)));
    const tok = m[0];
    const el = document.createElement(tok.startsWith('**') ? 'strong' : 'code');
    el.textContent = tok.startsWith('**') ? tok.slice(2, -2) : tok.slice(1, -1);
    out.push(el);
    last = i + tok.length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

export function renderMarkdown(md: string, baseHeading = 3): DocumentFragment {
  const frag = document.createDocumentFragment();
  let list: HTMLOListElement | HTMLUListElement | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      const p = document.createElement('p');
      for (const n of inline(para.join(' '))) p.appendChild(n);
      frag.appendChild(p);
      para = [];
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const hd = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (hd) {
      flushPara();
      list = null;
      const level = Math.min(6, baseHeading + hd[1].length - 1);
      const el = document.createElement(`h${level}` as 'h3');
      for (const n of inline(hd[2])) el.appendChild(n);
      frag.appendChild(el);
    } else if (ul || ol) {
      flushPara();
      const wanted = ol ? 'OL' : 'UL';
      if (!list || list.tagName !== wanted) {
        list = document.createElement(wanted.toLowerCase() as 'ul');
        frag.appendChild(list);
      }
      const li = document.createElement('li');
      for (const n of inline((ul ?? ol)![1])) li.appendChild(n);
      list.appendChild(li);
    } else if (line.trim() === '') {
      flushPara();
      list = null;
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  return frag;
}
