/**
 * Sohbet widget'ı.
 *
 * Akış: kullanıcı yazar → POST /api/chat → cevap Markdown olarak balona çizilir.
 *
 * Konuşma yalnızca tarayıcı belleğinde tutulur; pencere kapanınca silinir.
 * Sunucu hiçbir mesajı kaydetmez.
 *
 * Bu dosya embed.js tarafından shadow DOM içine kurulur; ekrandaki her şey
 * mountWidget() içinde üretilir.
 */

import { renderMarkdown } from "./markdown.js";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];
const ATTACHMENT_PROMPT = "Ekteki dosyayı inceler misin?";

const TEMPLATE = `
  <button class="launcher" part="launcher" type="button" aria-label="Destek sohbetini aç" aria-expanded="false">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5Z"/></svg>
  </button>

  <section class="chat" aria-label="Destek sohbeti">
    <header class="chat-header">
      <img class="brand" alt="" hidden />
      <div class="identity">
        <span class="title"></span>
        <span class="status"><span class="dot"></span><span class="status-text"></span></span>
      </div>
      <button class="close" type="button" aria-label="Sohbeti kapat">×</button>
    </header>

    <div class="content">
      <div class="welcome">
        <h2></h2>
        <p></p>
        <div class="cards"></div>
      </div>
      <div class="stream"></div>
    </div>

    <div class="composer">
      <form class="message-form">
        <input class="message" autocomplete="off" aria-label="Mesajınız" />
        <button class="attach file-button" type="button" aria-label="Dosya ekle" title="Dosya ekle" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>
        </button>
        <input class="file-input" type="file" hidden />
        <button class="send" type="submit" aria-label="Gönder">↑</button>
      </form>
      <div class="attachment-note" hidden></div>
      <p class="hint"></p>
    </div>

    <div class="dropzone" hidden><strong>Bırakın, ekleyeyim</strong><span>Görsel, PDF veya TXT · en fazla 4 MB</span></div>
  </section>
`;

export function mountWidget({ root, apiBase, config }) {
  const wrapper = document.createElement("div");
  wrapper.className = "widget";
  wrapper.innerHTML = TEMPLATE;
  root.appendChild(wrapper);

  const $ = (selector) => wrapper.querySelector(selector);
  const ui = {
    chat: $(".chat"), launcher: $(".launcher"), content: $(".content"), stream: $(".stream"),
    welcome: $(".welcome"), cards: $(".cards"), input: $(".message"), form: $(".message-form"),
    note: $(".attachment-note"), hint: $(".hint"), dropzone: $(".dropzone"),
    fileButton: $(".file-button"), fileInput: $(".file-input"), brand: $(".brand"), status: $(".status")
  };

  // --- Ayarları ekrana uygula -----------------------------------------------

  wrapper.style.setProperty("--ana", config.renkler?.ana || "#4f46e5");
  wrapper.style.setProperty("--vurgu", config.renkler?.vurgu || "#f97316");
  wrapper.dataset.konum = config.konum === "sol" ? "sol" : "sag";

  $(".title").textContent = config.botAdi || "Destek";
  if (config.durumYazisi) $(".status-text").textContent = config.durumYazisi;
  else ui.status.hidden = true;

  if (config.logo) {
    ui.brand.src = config.logo.startsWith("http") ? config.logo : `${apiBase}${config.logo}`;
    ui.brand.hidden = false;
    ui.brand.addEventListener("error", () => { ui.brand.hidden = true; }, { once: true });
  }

  $(".welcome h2").textContent = config.karsilama?.baslik ?? "";
  $(".welcome p").textContent = config.karsilama?.metin ?? "";
  ui.input.placeholder = config.mesajKutusuYazisi || "Mesajınızı yazın...";

  for (const card of config.hizliBaslangic ?? []) {
    const button = el("button", "card");
    button.type = "button";
    const text = el("span", "card-text");
    text.append(el("strong", "", card.baslik ?? ""), el("span", "card-desc", card.aciklama ?? ""));
    button.append(text, el("span", "card-chevron", "›"));
    button.addEventListener("click", () => sendMessage(card.baslik ?? ""));
    ui.cards.appendChild(button);
  }

  const fileSupported = config.dosyaEki && (config.dosyaOkuma?.gorsel || config.dosyaOkuma?.pdf);
  ui.fileButton.hidden = !config.dosyaEki;
  ui.hint.textContent = config.dosyaEki
    ? (fileSupported ? "Dosyayı buraya sürükleyebilirsiniz · PNG, JPG, PDF, TXT · maks 4 MB" : "Dosya gönderebilirsiniz; bu modelde yalnızca metin dosyaları okunur.")
    : "";
  ui.hint.hidden = !ui.hint.textContent;

  // --- Durum ----------------------------------------------------------------

  const history = [];
  let sessionId = 0;
  let pendingAttachment = null;
  let dragDepth = 0;

  // --- Olaylar --------------------------------------------------------------

  ui.launcher.addEventListener("click", () => toggle());
  $(".close").addEventListener("click", () => toggle(false));
  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = ui.input.value;
    ui.input.value = "";
    sendMessage(text);
  });
  ui.fileButton.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) attachFile(file);
  });

  ui.chat.addEventListener("dragenter", (event) => {
    if (!config.dosyaEki || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    ui.dropzone.hidden = false;
  });
  ui.chat.addEventListener("dragover", (event) => { if (config.dosyaEki && hasFiles(event)) event.preventDefault(); });
  ui.chat.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) ui.dropzone.hidden = true; });
  ui.chat.addEventListener("drop", (event) => {
    if (!config.dosyaEki || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    ui.dropzone.hidden = true;
    const [file] = event.dataTransfer.files;
    if (file) attachFile(file);
  });

  function hasFiles(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  // --- Pencere --------------------------------------------------------------

  function toggle(open = !ui.chat.classList.contains("open")) {
    ui.chat.classList.toggle("open", open);
    ui.launcher.setAttribute("aria-expanded", String(open));
    ui.launcher.classList.toggle("hidden", open);
    if (open) ui.input.focus();
    else reset();
  }

  /** Pencere kapanınca konuşmadan geriye hiçbir şey kalmaz. */
  function reset() {
    sessionId += 1;
    history.length = 0;
    pendingAttachment = null;
    ui.stream.textContent = "";
    ui.welcome.hidden = false;
    ui.note.hidden = true;
    ui.input.value = "";
    ui.content.scrollTop = 0;
  }

  // --- Sohbet ---------------------------------------------------------------

  async function sendMessage(text) {
    const trimmed = String(text).trim();
    const attachment = pendingAttachment;
    if (!trimmed && !attachment) return;

    clearQuickReplies();

    const body = trimmed || ATTACHMENT_PROMPT;
    addMessage(body, "user");
    const entry = { role: "user", content: body };
    if (attachment) entry.attachments = [attachment];
    history.push(entry);
    clearAttachment();

    const session = sessionId;
    const typing = addTyping();
    try {
      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: trimHistory() })
      });
      const data = await response.json().catch(() => ({}));
      if (session !== sessionId) return;
      if (!response.ok) throw new Error(data.error || "Bir hata oluştu. Lütfen tekrar deneyin.");

      const reply = String(data.reply ?? "").trim();
      typing.remove();
      if (!reply) throw new Error("Boş cevap alındı. Lütfen tekrar deneyin.");

      addMessage(reply, "bot");
      history.push({ role: "assistant", content: reply });
      renderQuickReplies();
    } catch (error) {
      if (session !== sessionId) return;
      typing.remove();
      addMessage(error.message || "Bağlantı kurulamadı. Lütfen tekrar deneyin.", "bot");
    }
  }

  /**
   * Sunucuya giden geçmiş. Görsel/PDF gövdesi yalnızca EN SON ek için taşınır:
   * kullanıcı bir ekran görüntüsü yollayıp üstüne soru sormaya devam ettiğinde
   * görsel bağlamda kalır, ama her istek yeniden şişmez.
   */
  function trimHistory() {
    let remaining = 1;
    return [...history].reverse().map((message) => {
      if (!message.attachments?.length) return message;
      const attachments = message.attachments.map((file) => {
        if (file.mimeType === "text/plain") return file;
        if (remaining > 0) { remaining -= 1; return file; }
        return { name: file.name, mimeType: file.mimeType };
      });
      return { ...message, attachments };
    }).reverse();
  }

  // --- Hazır cevaplar -------------------------------------------------------

  function renderQuickReplies() {
    clearQuickReplies();
    if (!config.hizliCevaplar?.length) return;
    const row = el("div", "quick-replies");
    for (const label of config.hizliCevaplar) {
      const button = el("button", "quick-reply", label);
      button.type = "button";
      button.addEventListener("click", () => sendMessage(label));
      row.appendChild(button);
    }
    ui.stream.appendChild(row);
    scroll();
  }

  function clearQuickReplies() {
    for (const row of ui.stream.querySelectorAll(".quick-replies")) row.remove();
  }

  // --- Ekler ----------------------------------------------------------------

  async function attachFile(file) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      addMessage(`Bu dosya türü desteklenmiyor${file.type ? ` (${file.type})` : ""}. Görsel, PDF veya düz metin gönderebilirsiniz.`, "bot");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      addMessage(`Dosya çok büyük (${size(file.size)}). En fazla ${size(MAX_ATTACHMENT_BYTES)} gönderebilirsiniz.`, "bot");
      return;
    }

    let data;
    try {
      data = await readBase64(file);
    } catch {
      addMessage("Dosya okunamadı. Lütfen tekrar deneyin.", "bot");
      return;
    }

    pendingAttachment = { name: file.name, mimeType: file.type, data };
    ui.note.textContent = "";
    const remove = el("button", "attachment-remove", "Kaldır");
    remove.type = "button";
    remove.addEventListener("click", clearAttachment);
    ui.note.append(el("span", "attachment-name", `Eklendi: ${file.name} (${size(file.size)})`), remove);
    ui.note.hidden = false;
  }

  function clearAttachment() {
    pendingAttachment = null;
    ui.note.textContent = "";
    ui.note.hidden = true;
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const base64 = String(reader.result).split(",")[1] ?? "";
        base64 ? resolve(base64) : reject(new Error("boş"));
      });
      reader.addEventListener("error", () => reject(reader.error ?? new Error("okunamadı")));
      reader.readAsDataURL(file);
    });
  }

  const size = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

  // --- Balonlar -------------------------------------------------------------

  function addMessage(text, type) {
    const bubble = el("div", `message ${type}`, type === "user" ? text : undefined);
    if (type !== "user") renderMarkdown(bubble, text);
    return appendRow(bubble, type);
  }

  function addTyping() {
    const typing = el("div", "typing");
    typing.append(el("span"), el("span"), el("span"));
    return appendRow(typing, "bot", false);
  }

  function appendRow(bubble, type, stamp = true) {
    ui.welcome.hidden = true;
    const row = el("div", type === "user" ? "row from-user" : "row");
    const column = el("div", "bubble-col");
    column.appendChild(bubble);
    if (stamp) column.appendChild(el("time", "stamp", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
    if (type !== "user" && config.logo) {
      const avatar = el("img", "avatar");
      avatar.src = config.logo.startsWith("http") ? config.logo : `${apiBase}${config.logo}`;
      avatar.alt = "";
      row.appendChild(avatar);
    }
    row.appendChild(column);
    ui.stream.appendChild(row);
    scroll();
    return row;
  }

  function scroll() {
    ui.content.scrollTop = ui.content.scrollHeight;
  }

  function el(tag, className = "", text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  return { ac: () => toggle(true), kapat: () => toggle(false) };
}
