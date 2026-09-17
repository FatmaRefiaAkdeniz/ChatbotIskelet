/**
 * Chatbot'u herhangi bir siteye ekleyen tek satır.
 *
 *   <script src="https://chatbot-adresiniz.com/embed.js" defer></script>
 *
 * Sayfanın kendi CSS ve JS'ine karışmaz: widget kapalı bir "shadow DOM"
 * içinde kurulur, dışarıya hiçbir stil veya id sızmaz.
 */
(() => {
  const script = document.currentScript;
  const base = new URL(".", script?.src ?? location.href).href.replace(/\/$/, "");

  // Aynı sayfaya iki kez eklenirse ikinci kopya kurulmasın.
  if (window.__chatbotYuklendi) return;
  window.__chatbotYuklendi = true;

  const host = document.createElement("div");
  host.id = "chatbot-host";
  // Sayfanın kendi katmanlarının üstünde kalır; içerik akışını etkilemez.
  host.style.cssText = "position:relative;z-index:2147483000";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `${base}/widget.css`;
  shadow.appendChild(style);

  const start = async () => {
    document.body.appendChild(host);
    try {
      const response = await fetch(`${base}/api/config`);
      if (!response.ok) throw new Error(`Ayarlar alınamadı (${response.status})`);
      const config = await response.json();
      const { mountWidget } = await import(`${base}/widget.js`);
      mountWidget({ root: shadow, apiBase: base, config });
    } catch (error) {
      // Sohbet açılamazsa sayfanın geri kalanı etkilenmesin; sebebi konsola yazılır.
      console.error("[chatbot] başlatılamadı:", error);
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
