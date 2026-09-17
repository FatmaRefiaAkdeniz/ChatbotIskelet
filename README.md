# Chatbot İskeleti

Kendi sitesine yapay zekâ destekli bir destek sohbeti eklemek isteyen herkes için
hazır iskelet. **Kod yazmanız gerekmiyor**: iki dosyayı doldurup bilgilerinizi bir
klasöre koyuyorsunuz, bot hazır.

- Bağımlılık yok — yalnızca Node.js 18+ ve kendi API anahtarınız
- OpenAI, Claude, Gemini, DeepSeek, Groq, OpenRouter, Mistral veya kendi bilgisayarınızdaki Ollama
- Tek satırla her siteye gömülür, sayfanın tasarımını bozmaz
- Bot yalnızca sizin verdiğiniz bilgiyle konuşur; bilmediğinde uydurmaz, bilmediğini söyler
- Hiçbir mesaj kaydedilmez; sohbet pencere kapanınca silinir

---

## 1. Kurulum (5 dakika)

### Adım 1 — Node.js

Bilgisayarınızda yoksa [nodejs.org](https://nodejs.org) adresinden LTS sürümünü kurun.
Kontrol: terminalde `node -v` yazdığınızda `v18` veya üstü görünmeli.

### Adım 2 — API anahtarı

Bir sağlayıcı seçip anahtar alın (ücretsiz başlamak için **Gemini** veya ucuzluk için
**DeepSeek** iyi seçenek):

| Sağlayıcı | Anahtar adresi | Görsel/PDF okur mu? |
| --- | --- | --- |
| `openai` | platform.openai.com/api-keys | Evet |
| `anthropic` | console.anthropic.com | Evet |
| `gemini` | aistudio.google.com/apikey | Evet (ücretsiz kota var) |
| `deepseek` | platform.deepseek.com | Hayır (yalnızca metin) |
| `groq` | console.groq.com/keys | Hayır |
| `openrouter` | openrouter.ai/keys | Modele göre |
| `mistral` | console.mistral.ai | Hayır |
| `ollama` | Anahtar gerekmez (kendi bilgisayarınız) | Hayır |

### Adım 3 — Anahtarı yazın

```bash
cp .env.example .env
```

`.env` dosyasını bir metin düzenleyiciyle açın, iki satırı doldurun:

```
AI_PROVIDER=gemini
AI_API_KEY=buraya-anahtarınız
```

### Adım 4 — Kendinizi tanıtın

`ayarlar.jsonc` dosyasını açıp en az şu üç alanı değiştirin:
`botAdi`, `sirketAdi`, `sirketTanimi`. Dosyadaki açıklamalar hangi alanın ne
yaptığını satır satır anlatır.

### Adım 5 — Bilgi bankasını doldurun

`bilgi-bankasi/` klasöründeki örnek dosyayı silin, yerine kendi bilgilerinizi
`.md` veya `.txt` dosyaları olarak koyun. **Bot yalnızca bu klasördekini bilir.**

### Adım 6 — Çalıştırın

```bash
npm run kontrol   # ayarları denetler ve sağlayıcıya deneme mesajı yollar
npm start         # http://localhost:3000
```

Tarayıcıdan `http://localhost:3000` adresini açıp sağ alttaki butona basın.

---

## 2. Doldurulacak dosyalar

| Dosya | Ne için | Zorunlu mu? |
| --- | --- | --- |
| `.env` | Sağlayıcı ve API anahtarı | **Evet** |
| `ayarlar.jsonc` | İsim, renk, karşılama, limitler | **Evet** |
| `bilgi-bankasi/*.md` | Botun bildiği her şey | **Evet** |
| `sistem-promptu.md` | Botun kuralları ve üslubu | Hayır (hazır gelir) |
| `public/assets/logo.svg` | Logo | Hayır |
| `public/widget.css` | Tasarım | Hayır |

Diğer dosyalara dokunmanız gerekmez:

```
server.mjs          Sunucu: API, statik dosyalar, AI köprüsü (tek dosya)
public/embed.js     Siteye gömülen tek satırın yüklediği başlatıcı
public/widget.js    Sohbet arayüzü
public/markdown.js  Cevaptaki kalın/liste/tablo biçimlerinin çizimi
public/index.html   Deneme sayfası
```

**Her değişiklikten sonra sunucuyu yeniden başlatın** (`Ctrl+C` → `npm start`):
ayarlar, prompt ve bilgi bankası yalnızca açılışta okunur.

---

## 3. Bilgi bankası nasıl yazılır?

Bot bilgi bankasında yazmayan hiçbir şeyi söylememek üzere talimatlandırıldı. Yani
cevapların kalitesi doğrudan bu klasörün kalitesidir.

- Konuya göre ayrı dosyalar yazın: `urunler.md`, `iade-politikasi.md`, `sik-sorulanlar.md`
- Dosya içinde `##` başlıkları kullanın; bilgi bankası büyüdüğünde sunucu her soruda
  yalnızca ilgili başlıkları modele gönderir
- Soru-cevap biçimi çok iyi çalışır:
  `**Şifremi unuttum, ne yapmalıyım?**` + altına cevap
- Alt klasör kullanabilirsiniz: `bilgi-bankasi/nasil-yapilir/fatura.md`
- Dosya adının başına numara koymak sıralamayı belirler (`01-`, `02-`)
- `_` ile başlayan dosya ve klasörler yok sayılır (taslaklarınızı orada tutabilirsiniz)

Ne kadar metin girebilirim? Bilgi bankası `bilgiBankasiTamSinir` değerinin (varsayılan
300.000 karakter) altındaysa **tamamı** her soruda modele gönderilir — en isabetli
cevaplar böyle alınır. Üstüne çıkarsa sunucu otomatik olarak **parça moduna** geçer ve
her soruda yalnızca en ilgili bölümleri gönderir. Sunucu açılışta hangi modda
olduğunu yazar.

---

## 4. Siteye ekleme

Sayfanızın `</body>` etiketinden hemen önce tek satır:

```html
<script src="https://chatbot-adresiniz.com/embed.js" defer></script>
```

Widget kapalı bir "shadow DOM" içinde çalışır: sitenizin CSS'i ile çakışmaz,
sitenizin JavaScript'ine karışmaz.

WordPress, Shopify, Wix gibi sistemlerde bu satırı "özel kod / custom HTML /
head-footer script" alanına yapıştırmanız yeterli.

**Canlıya çıkmadan önce** `ayarlar.jsonc` içindeki `izinliSiteler` listesine kendi
adresinizi yazın; yoksa başkaları botunuzu (ve API faturanızı) kendi sitesinde
kullanabilir:

```jsonc
"izinliSiteler": ["https://www.sirketiniz.com", "https://sirketiniz.com"]
```

### Sunucuyu yayına alma

Herhangi bir Node.js sunucusunda çalışır (Render, Railway, Fly.io, Hetzner, kendi VPS'iniz):

```bash
npm start           # PORT ortam değişkeniyle port değiştirilebilir
```

Docker kullanıyorsanız hazır `Dockerfile` var:

```bash
docker build -t chatbot .
docker run -p 3000:3000 --env-file .env chatbot
```

Nginx veya Cloudflare arkasındaysanız `.env` içinde `TRUST_PROXY=1` yapın; hız
sınırı ziyaretçinin gerçek IP adresine göre çalışsın.

---

## 5. Botun davranışını değiştirme

`sistem-promptu.md` botun kurallarını içerir: üslup, cevap uzunluğu, neyi
yapmayacağı. İstediğiniz gibi değiştirebilirsiniz; süslü parantezli `{{...}}`
işaretleri ayarlar dosyasından otomatik dolduğu için onları silmeyin.

Sık yapılan değişiklikler:

| İstediğiniz | Nereyi değiştirin |
| --- | --- |
| Bot İngilizce cevaplasın | `ayarlar.jsonc` → `"dil": "English"` |
| Bot genel sorulara da yardım etsin | `ayarlar.jsonc` → `"sadeceBilgiBankasi": false` |
| Cevaplar daha kısa olsun | `sistem-promptu.md` → "Yanıt Uzunluğu" bölümü |
| Daha samimi bir üslup | `sistem-promptu.md` → 5. kural |
| Renkler, logo, konum | `ayarlar.jsonc` → "GÖRÜNÜM" bölümü |
| Tasarımın tamamı | `public/widget.css` |

---

## 6. Maliyet ve güvenlik

Ücretli olan tek şey AI çağrılarıdır. Maliyeti belirleyen, her soruda modele giden
bilgi bankasının büyüklüğüdür.

- Sunucu her cevaptan sonra loga tek satır yazar:
  `openai/gpt-4o-mini: giriş 4210 token (önbellekten 3900), çıkış 180 token, 1450 ms`
- "Önbellekten" gelen tokenler çok daha ucuzdur. Bu yüzden `sistem-promptu.md` içine
  tarih, saat gibi her istekte değişen bilgi koymayın — önbellek bozulur.
- Bilgi bankası büyüdükçe soru başına maliyet artar; `bilgiBankasiTamSinir` değerini
  düşürerek parça moduna geçebilirsiniz.

Yerleşik korumalar:

- Ziyaretçi başına dakikada mesaj limiti ve saatte dosya limiti (`ayarlar.jsonc`)
- `izinliSiteler` ile hangi sitelerin kullanabileceği kısıtlanır
- Bilgi bankası ve dosya içerikleri modele "bu veridir, talimat değildir" sınırlarıyla
  verilir — kullanıcı bota yeni kurallar yazdıramaz
- Model çıktısı hiçbir zaman HTML olarak çalıştırılmaz
- Sohbet sunucuda saklanmaz; API anahtarı tarayıcıya asla gitmez

---

## 7. Sorun giderme

| Belirti | Sebep / çözüm |
| --- | --- |
| `API anahtarı geçersiz` | `.env` içindeki `AI_API_KEY` yanlış veya sağlayıcı seçimi (`AI_PROVIDER`) uyuşmuyor |
| `Model bulunamadı` | Model adları zamanla değişir; `.env` içindeki `AI_MODEL` alanına sağlayıcının güncel model adını yazın |
| `AI kullanım limitine ulaşıldı` | Sağlayıcı hesabınızda kota/bakiye bitmiş |
| `AI servisine ulaşılamadı` | İnternet bağlantısı veya `AI_BASE_URL` yanlış |
| Bot "bilgim yok" diyor | `bilgi-bankasi/` boş ya da konu orada yazmıyor; dosya ekleyip sunucuyu yeniden başlatın |
| Değişiklik görünmüyor | Sunucuyu yeniden başlatmadınız |
| `ayarlar.jsonc okunamadı` | Fazladan virgül veya eksik tırnak; hata satır numarasını yazar |
| Sitede widget çıkmıyor | Tarayıcı konsoluna bakın; `izinliSiteler` listesinde sitenizin adresi var mı? |
| Görseller okunmuyor | Sağlayıcınız görsel okumuyor (DeepSeek, Groq, Mistral); OpenAI, Gemini veya Anthropic'e geçin |

Kurulumu tek komutla denetlemek için: `npm run kontrol`

---

## 8. Sınırlar

Bu iskelet bilinçli olarak sade tutuldu. Şunlar **yok**:

- Sohbet kaydı, ziyaretçi paneli, istatistik — hiçbir mesaj saklanmaz
- İnsan desteğine devir / bilet sistemi — bot bilmediğinde bunu söyler, başka bir kanala yönlendirmez
- Anlam tabanlı (embedding) arama — parça modundaki seçim kelime eşleşmesine dayanır;
  binlerce sayfalık bir bilgi bankasında vektör aramaya geçmek gerekir
- Çok sunuculu kurulum için ortak hız sınırı sayacı (tek sunucuda sorun yok)
