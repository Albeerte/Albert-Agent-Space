# Albert Agent Space 0.8.0 — tekshiruvlar

2026-11-18, Windows, Node.js 24.19.0.

| Tekshiruv | Natija |
| --- | --- |
| Avtomatik tekshiruvlar | 29/29 o`tdi. IT worktree, test, diff va egasi tasdig`i; AI taqqoslash; xotira; iyerarxiya; private ruxsatlari; lokal rejim va pulli fallback chegaralari qayta tekshirildi. |
| Yangi kodlar | Besh yangi repo aniq commitlarda yuklandi. 26 repo registryda, 25 ta asl manba namunasi paketda. Tanlangan qayta ishlatilgan runtime fayllari va litsenziyalar OFFICE-RUNTIME.md ichida. |
| Yo`l topish | Qayta ishlatilgan A* moduli eshikdan o`tishi, jihozlarni aylanib o`tishi va yopiq devordan yo`l topmasligi sinovdan o`tdi. |
| Tayyor jamoalar | Mahsulot, Tadqiqot va Kontent andozalari Git checkout yo`q alohida muhitga ikki martadan import qilindi. Agentlar takrorlanmadi. |
| Personaj tanlovi | Egasi 0–5 oralig`idagi personajni saqlay oladi. Noto`g`ri qiymat va agent tokeni rad qilindi. Eski mijoz personaj maydonini yubormasa avvalgi tanlov saqlanadi. Baza qayta ochilganda tanlov tiklandi. |
| Chrome | Yangi ranglar, jamoalar qatori, Development tanlanganda xarita va chatning birga almashishi, ofisni kengaytirish, 6 personaj rasmi, sozlamalar yon menyusi va texnik havolasiz jamoa oynasi ko`rildi. |
| Serverdagi ma`lumotlar | 0 faol vazifa bor paytda server qayta ishga tushirildi. Avvalgi 4 bosqichli tarjima topshirig`i va rahbar-xodim hisobot bog`lanishlari qayta o`qildi. |

Brauzerda personaj oynasini tekshirish uchun yangi agent yaratilmagan. Personaj saqlanishi alohida vaqtinchalik sinov bazasida tekshirilgan. Shu nashrda bulut provayderlari, foydalanuvchining GitHub draft PR`i, Docker Compose va barcha mustaqil tashqi ilovalar jonli ishga tushirilmagan. Avvalgi jonli lokal model tekshiruvlari quyida qayd etilgan.

## Oldingi nashrlarning tekshiruvlari

### AI Agent Office 0.3.0

2026-11-18, Windows, Node.js 24.19.0 va Git 2.55.0. Avvalgi versiyadan qolgan ma’lumotlar bazasi bilan ofis qayta ishga tushirildi.

| Tekshiruv | Natija |
| --- | --- |
| Avtomatik testlar | 24/24 o‘tdi. Git worktree, diff va tasdiq izi, agent ruxsatlari, provayder/fallback, xotira, versiyalar va tiklash, 10 ta tashqi profil protokoli, eksport va takliflar tekshirildi. |
| Kod nusxalari | 20/20 rasmiy repo belgilangan SHA bilan yuklandi. Har bir Git daraxtidan kamida bitta fayl haqiqiy HTTP orqali o‘qildi. ZIP ichidagi 20 tanlangan fayl uchun Git blob xeshi testda qayta hisoblandi. |
| Brauzer | Chrome’da alohida sinov bazasida Ochiq kod markazi va loyiha kartalari ochildi. Asosiy serverning /healthz manzili HTTP 200 va 0.3.0 qaytardi. |
| City Accountants | Buxgalteriya, Tarjima, Hujjatlar xonalari va 6 agent yaratildi. Lokal Qwen topshiriqni bajardi. Server qayta ochilganda 18 agent, model biriktirishlari va tugallangan vazifa saqlandi. |
| Doimiy ko‘nikma | Pixel Agents gameLoop.ts fayli lokal modelda tahlil qilindi. Manba, model va Git blob bilan taklif saqlandi. Qarorni egasi beradi. |
| Edict | Asl Python GET handleriga Edict'ning rasmiy demo ma’lumotlari berildi. Office adapteri undan 24 ta vazifa va 9 ta rolni HTTP orqali o‘qidi. Bular Edict demo yozuvlari. |
| Lokal model sinovi | qwen3-vl:8b-instruct haqiqiy javob berdi. gemma3:1b va deepseek-r1:1.5b yuklandi va ikkalasi ham bitta savolga javob qaytardi. Qat’iy matn mosligida Gemma 1/1, DeepSeek 0/1. Bitta savol model sifati bo‘yicha reyting bermaydi. |
| Shaxsiy hujjat | Vaqtinchalik, faqat sinovga tegishli SQLite bazasiga hujjat yuklandi. Lokal Ollama javob berdi va javob external=0 bilan saqlandi. IT agent tokeni shu bo‘limdan HTTP 403 oldi. |
| AI Department | Haqiqiy Qwen profilida ikkita turli prompt bitta savol bilan solishtirildi, har ikkisi 1/1. Har bir javob, model, baho va davomiylik saqlandi. |
| IT Company | Haqiqiy lokal Git worktree, kod o‘zgarishi, test, diff, egasi tasdig‘i va DEMO draft yozuvi haqiqiy HTTP orqali tekshirildi. GitHub'da PR ochilmadi. |
| Native Python worker | AG2, AutoGen va Swarms alohida virtual muhitlarda o‘rnatildi. Office model profilidan autentifikatsiyalangan worker orqali lokal Qwen modeliga jonli chaqiruv muvaffaqiyatli bo‘ldi. |
| Tashqi xizmatlar | ChatDev, Sim, Langflow, Mastra va barcha SDK protokollarida aniq so‘rov, javobni ajratish va xato yo‘li fixture bilan tekshirildi. Native xizmatga jonli tekshiruv yuqorida alohida qayd etilgan hollarda bajarildi. CompanyOS va LibreChat uchun fayl eksporti bor. |
| Ishga tushirish shartlari | Docker CLI mavjud emas edi. Compose build, egasining GitHub draft PR'i, Paperclip sinxronizatsiyasi, OpenClaw/Codex login, bulut gatewaylari va pulli providerlar uchun jonli qabul sinovi qolgan. |

## Qayta tekshirish

### Albert Agent Space 0.7.0

28 avtomatik test o‘tdi. Barcha korxona agentlari hisobotini yig‘ish, bevosita xodimga buyruq uzatish, xato hisobotini yuqoriga chiqarish, nomi aytilgan bo‘limga aniq yo‘naltirish va private agentni tashqarida saqlash tekshirildi. Asosiy ofisda lokal Qwen bilan haqiqiy hisobot oqimi bajarildi. 18 agent, jumladan CEO, hisobotini yakunladi. CEO umumiy hisoboti va har bir quyi hisobot API orqali qayta o‘qildi. Har bir quyi agentning rahbari mosligi va barcha tugunlar Bajarildi holatida ekani tasdiqlandi. 

Chrome’da olti sozlamalar bo‘limi, Ko‘rinish formasi va model profillari ochildi. Yetti so‘ralgan repo checkout buyruqlari muvaffaqiyatli yakunlandi, GitHub ulanishi har bir rasmiy reponi o‘qidi. Barcha tashqi ilovalarning alohida serveri ishga tushirilmagan. Xizmatga xos adapter, konfiguratsiya eksporti va tanlangan kod manbalari PROJECTS.md’da ko‘rsatilgan.

Buyruqning alohida jonli sinovida CEO → Head of AI → Tarjima rahbari → Tarjimon zanjiri orqali inglizcha tarjima so‘raldi va hisobot shu zanjir bo‘ylab qaytdi.  Dastlabki rejalash sinovida model noto‘g‘ri bo‘limni tanlagani uchun aniq xona nomi bo‘yicha yo‘naltirish qo‘shildi. Avvalgi sinov yozuvlari ham tarixda saqlangan.

### Albert Agent Space 0.6.0

24 avtomatik test o‘tdi. Chrome’da chapdagi jamoa boshqaruvi, yuqoridagi ish oynalari, xona yo‘laklari, harakatlanuvchi agentlar va xaritaning 120% kattalashtirish holati ko‘rildi. Yurish faqat vizual animatsiya. Serverdagi haqiqiy vazifa holati avvalgi yagona vazifa yozuvidan olinadi.

Asosiy ofisda brauzerning Jamoa chati orqali CTO agentga lokal sinov yuborildi. Agent haqiqiy lokal modelda `ALBERT-READY` javobini berdi va holati Bajarildi bo‘ldi. Bu tekshiruv yozuvi ofisda saqlangan.

### Albert Agent Space 0.5.0

- Chrome’da jonli xarita, xona va bajaruvchi tanlovi, jamoa chatining yozish oynasi va yakunlangan ishlar hisoboti tekshirildi.
- Vaqtinchalik ofisda Development jamoasining Tech Lead agenti mahalliy `qwen3-vl:8b-instruct` modelidan `ALBERT-READY` javobini oldi. Chat va Kanban bir xil vazifani ko‘rsatdi. Bir xil so‘rov qayta yuborilganda ikkinchi vazifa yaratilmagan. Server qayta ishga tushganda chat javobi va holati tiklandi.
- Korxona chatida Private Workspace va boshqa xona agentini tanlash so‘rovlariga server ruxsat bermadi. Agent tokeni korxona chatini o‘qiy olmadi. 24 avtomatik test o‘tdi.

### Albert Agent Space 0.4.0

Chrome’da yangi xarita 18 agent bilan ochildi. Egasi oynasida uchta ish muhitini tanlash mumkin. 21 ta Git manbasi ishchi kompyuterga yuklandi. Muratify’ning tanlangan commitidagi Mahsulot (5 rol), Tadqiqot (3 rol) va Kontent (4 rol) andozalari alohida SQLite bazasiga ikki martadan import qilindi. Rollar takrorlanmadi, rahbarlar va qabul mezonlari saqlandi. CrewAI ham alohida muhitda Office orqali lokal Qwen modelidan HTTP 200 javobini oldi. MetaGPT uchun kerakli lancedb 0.4.0 Windows paketini topib bo‘lmadi. Google ADK bog‘liqliklarini yuklash vaqt chegarasidan oshdi. Bu ikkisining jonli model sinovi tasdiqlanmagan. Sim uchun Office adapterining so‘rov-javob testi o‘tdi. Docker mavjud bo‘lmagani sababli Sim serverida jonli workflow bajarilmadi.

```powershell
npm run setup
npm run doctor
npm test
node scripts/verify-local.mjs qwen3-vl:8b-instruct
```

Oxirgi buyruq alohida vaqtinchalik Office bazasi va bo‘sh portdan foydalanadi. Unga ishlayotgan Ollama va ko‘rsatilgan lokal model kerak. Ishlayotgan asosiy Office'da demo yozuvlar yaratib tekshirish uchun `npm run smoke` buyrug‘i ham mavjud.

Manbalar va litsenziyalar [PROJECTS.md](PROJECTS.md) hamda [SAMPLES.md](third-party/SAMPLES.md) fayllarida. Qolgan xizmatlarning port, model, profil va worker sozlamalari [PROJECTS.md](PROJECTS.md) faylida keltirilgan.
