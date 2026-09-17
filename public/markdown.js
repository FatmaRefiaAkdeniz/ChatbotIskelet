/**
 * Sohbet balonundaki Markdown çizimi: **kalın**, *italik*, `kod`, başlık,
 * madde ve numaralı listeler, alıntı, çizgi ve tablo.
 *
 * Hiçbir yerde innerHTML kullanılmaz — model çıktısı HTML olarak yorumlanmaz.
 */

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|(?<![*\w])\*[^*\n]+\*(?!\w)|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/[^\s)]+)\))/g;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function appendInline(parent, text) {
  for (const piece of String(text).split(INLINE)) {
    if (!piece) continue;
    if (piece.startsWith("**") && piece.endsWith("**")) parent.appendChild(el("strong", "", piece.slice(2, -2)));
    else if (piece.startsWith("__") && piece.endsWith("__")) parent.appendChild(el("strong", "", piece.slice(2, -2)));
    else if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) parent.appendChild(el("em", "", piece.slice(1, -1)));
    else if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) parent.appendChild(el("code", "", piece.slice(1, -1)));
    else if (piece.startsWith("[") && piece.includes("](")) {
      const [, label, href] = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/) ?? [];
      if (!label) { parent.appendChild(document.createTextNode(piece)); continue; }
      const link = el("a", "md-link", label);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.appendChild(link);
    } else parent.appendChild(document.createTextNode(piece));
  }
}

export function renderMarkdown(bubble, text) {
  let paragraph = null;
  let list = null;
  const closeAll = () => { paragraph = null; list = null; };

  const lines = String(text).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();

    if (!line.trim()) { closeAll(); continue; }

    if (RULE.test(line)) { closeAll(); bubble.appendChild(el("hr", "md-rule")); continue; }

    // Tablo: bu satırda "|" var ve bir sonraki satır ayraçsa.
    if (line.includes("|") && TABLE_DIVIDER.test(lines[index + 1] ?? "")) {
      closeAll();
      const rows = [splitRow(line)];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) rows.push(splitRow(lines[cursor++]));
      appendTable(bubble, rows);
      index = cursor - 1;
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      list = null;
      if (!paragraph || !paragraph.classList.contains("md-quote")) {
        paragraph = el("blockquote", "md-quote");
        bubble.appendChild(paragraph);
      } else paragraph.appendChild(el("br"));
      appendInline(paragraph, quote[1]);
      continue;
    }
    if (paragraph?.classList.contains("md-quote")) paragraph = null;

    // Başlıklar balon içinde kalın paragraf olarak gösterilir; gerçek başlık boyutları iri durur.
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      closeAll();
      const node = el("p", "md-heading");
      appendInline(node, heading[1]);
      bubble.appendChild(node);
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      paragraph = null;
      const wanted = bullet ? "UL" : "OL";
      if (!list || list.tagName !== wanted) {
        list = el(bullet ? "ul" : "ol", "md-list");
        if (numbered) list.start = Number(numbered[1]);
        bubble.appendChild(list);
      }
      const item = el("li");
      appendInline(item, bullet ? bullet[1] : numbered[2]);
      list.appendChild(item);
      continue;
    }

    list = null;
    if (!paragraph) {
      paragraph = el("p", "md-p");
      bubble.appendChild(paragraph);
    } else paragraph.appendChild(el("br"));
    appendInline(paragraph, line);
  }

  if (!bubble.childNodes.length) bubble.textContent = text;
}

function splitRow(line) {
  const cells = line.trim().split("|");
  if (cells[0].trim() === "") cells.shift();
  if (cells.length && cells.at(-1).trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

/**
 * Tablo. Sohbet balonu dar: satırlar yan yana sütun yerine alt alta kart olarak
 * dizilir (CSS), ama yapı gerçek bir <table> — metin seçilebilir, ekran okuyucu
 * başlıkları görür.
 */
function appendTable(bubble, rows) {
  const [header, ...body] = rows;
  const table = el("table", "md-table");

  const headRow = el("tr");
  for (const cell of header) {
    const th = el("th");
    appendInline(th, cell);
    headRow.appendChild(th);
  }
  const thead = el("thead");
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const row of body) {
    const tr = el("tr");
    for (let column = 0; column < header.length; column += 1) {
      const td = el("td");
      if (column === 0) td.className = "md-cell-key";
      else td.dataset.label = header[column] ?? "";
      appendInline(td, row[column] ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  bubble.appendChild(table);
}
