// Собственные векторные силуэты: одинаковое отображение без зависимости от шрифта.
function pieceArt(type, color) {
  const paths = {
    p: 'M24 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM19 22h10l-2 8 5 5v3H16v-3l5-5ZM13 39h22v5H13Z',
    r: 'M10 7h7v7h4V7h6v7h4V7h7v14l-5 4v11H15V25l-5-4ZM12 37h24v7H12Z',
    b: 'M24 5c-3 6-12 11-10 19 1 4 5 6 10 6s9-2 10-6c2-8-7-13-10-19ZM21 30h6l3 7H18ZM12 38h24v6H12Z',
    n: 'M14 37c0-9 3-14 12-18l-9 2-6 6-5-4L18 8l1-5 7 5c11 1 15 9 13 17l-4 12ZM11 38h27v6H11Z',
    q: 'M11 13l7 10 6-14 6 14 7-10-5 22H16ZM13 37h22v7H13Z',
    k: 'M22 3h4v5h5v4h-5v6h-4v-6h-5V8h5ZM24 22c-7-10-17-4-14 4l7 10h14l7-10c3-8-7-14-14-4ZM14 38h20v6H14Z'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('piece-art');
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[type]); path.setAttribute('fill', color === 'w' ? '#fffbee' : '#202f2a'); path.setAttribute('stroke', color === 'w' ? '#34483e' : '#c0cdbf'); path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path);
  if (type === 'b' || type === 'n') { const detail = document.createElementNS(svg.namespaceURI, 'path'); detail.setAttribute('d', type === 'b' ? 'M25 12l-6 8' : 'M20 13h2'); detail.setAttribute('stroke', color === 'w' ? '#34483e' : '#c0cdbf'); detail.setAttribute('stroke-width', '2.5'); detail.setAttribute('stroke-linecap', 'round'); svg.append(detail); }
  if (type === 'q') for (const [cx, cy] of [[10, 11], [24, 7], [38, 11]]) { const circle = document.createElementNS(svg.namespaceURI, 'circle'); circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', '3'); circle.setAttribute('fill', color === 'w' ? '#fffbee' : '#202f2a'); circle.setAttribute('stroke', color === 'w' ? '#34483e' : '#c0cdbf'); svg.append(circle); }
  return svg;
}
