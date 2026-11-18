# Upstream integrations and source provenance

The registry pins 26 projects. This distribution includes 25 selected original source samples, runtime modules/assets, and bundled team templates. Full upstream source trees are optional and are not committed here. The product UI provides native team/workflow actions; this file documents technical provenance.

`npm run projects -- list` lists pins. `npm run projects -- fetch all` downloads Git objects. `npm run projects -- checkout all` creates working trees and verifies commits. These commands need network access and substantial disk space. Existing edited working trees are retained. LFS pointers may require separate LFS downloads. Model weights are managed separately by Ollama.

| Loyiha | Commit | Litsenziya yoki shartlar | Office orqali bajariladigan amal |
| --- | --- | --- | --- |
| [Edict](https://github.com/cft0808/edict/tree/14a207557719c046af0f993a7bff1cc5a5015b33) | `14a207557719` | [MIT](https://github.com/cft0808/edict/blob/14a207557719c046af0f993a7bff1cc5a5015b33/LICENSE) | Edict'ning asl demo doskasi va haqiqiy xizmatdan `/api/live-status` o‘qish. Edict task ID'lari alohida ko‘rsatiladi. |
| [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents/tree/4dd14d612fd37d89ffbbc977959f572395c4eec8) | `4dd14d612fd3` | [MIT](https://github.com/pixel-agents-hq/pixel-agents/blob/4dd14d612fd37d89ffbbc977959f572395c4eec8/LICENSE) | Asl MIT animatsiya sikli asosiy ofis xaritasida ishlaydi. Ish joylari va personajlar Office tomonidan chiziladi. |
| [Pixel Office](https://github.com/fedevgonzalez/pixel-office/tree/464cb4c7b312aa0e079f738317ff4cdb04d6231e) | `464cb4c7b312` | [MIT (kod); grafika shartlari alohida](https://github.com/fedevgonzalez/pixel-office/blob/464cb4c7b312aa0e079f738317ff4cdb04d6231e/LICENSE) | `GET /api/status` orqali ishga tushirilgan Pixel Office agentlari va kutish holatini o‘qish. |
| [Kortix CompanyOS](https://github.com/kortix-ai/CompanyOS/tree/3fe7c67ffbad34d97f45ed64a91f28f39a879e68) | `3fe7c67ffbad` | [Elastic-2.0; white-label shartlari alohida](https://github.com/kortix-ai/CompanyOS/blob/3fe7c67ffbad34d97f45ed64a91f28f39a879e68/LICENSE) | Tasdiqlangan IT/AI ko‘nikmasini `.agents/skills/.../SKILL.md` formatida eksport qilish. Mustaqil CompanyOS o‘z sozlamalari bilan ishga tushiriladi. |
| [ChatDev](https://github.com/OpenBMB/ChatDev/tree/464a681ba7bda869db97a50c5fa707c9a0fb57a0) | `464a681ba7bd` | [Apache-2.0](https://github.com/OpenBMB/ChatDev/blob/464a681ba7bda869db97a50c5fa707c9a0fb57a0/LICENSE) | Profil tanlangan YAML ish jarayoniga `/api/workflow/run` orqali topshiriq yuboradi va `final_message` oladi. |
| [Kandev](https://github.com/kdlbs/kandev/tree/77804c2b27c28378d959be59bb3f7bed7c082636) | `77804c2b27c2` | [AGPL-3.0](https://github.com/kdlbs/kandev/blob/77804c2b27c28378d959be59bb3f7bed7c082636/LICENSE) | Ulangan Kandev'dan `/api/v1/workspaces` orqali ish joylarini ko‘rish. Office o‘z Kanban va Git worktree yozuvlarini yuritadi. |
| [Sim](https://github.com/simstudioai/sim/tree/27bb781a61a8d219cfb6ec6877bf691c930fe3c3) | `27bb781a61a8` | [Apache-2.0](https://github.com/simstudioai/sim/blob/27bb781a61a8d219cfb6ec6877bf691c930fe3c3/LICENSE) | API kalit va workflow ID bilan saqlangan oqimni bajarish. Trigger `input` nomli matn maydonini qabul qilishi kerak. |
| [Langflow](https://github.com/langflow-ai/langflow/tree/21381e5b2964fb4c714dc91fcd5187d4cfc2a67f) | `21381e5b2964` | [MIT](https://github.com/langflow-ai/langflow/blob/21381e5b2964fb4c714dc91fcd5187d4cfc2a67f/LICENSE) | Flow ID, `x-api-key` va `/api/v1/run/...` orqali chat kirishi va chat chiqishini ishlatish. |
| [AutoGen](https://github.com/microsoft/autogen/tree/8390985108cb1e3881f5f7297765758d8ad2540c) | `8390985108cb` | [MIT (kod); CC-BY-4.0 (hujjatlar)](https://github.com/microsoft/autogen/blob/8390985108cb1e3881f5f7297765758d8ad2540c/LICENSE) | Python worker ichida `AssistantAgent.run()` orqali javob olish. |
| [CrewAI](https://github.com/crewAIInc/crewAI/tree/2688bb6b8c329a4af72ef822c8056f2eaa83c995) | `2688bb6b8c32` | [MIT](https://github.com/crewAIInc/crewAI/blob/2688bb6b8c329a4af72ef822c8056f2eaa83c995/LICENSE) | Worker `Agent`, `Task` va `Crew.kickoff()` orqali bitta rolga biriktirilgan ishni bajaradi. |
| [MetaGPT](https://github.com/FoundationAgents/MetaGPT/tree/11cdf466d042aece04fc6cfd13b28e1a70341b1f) | `11cdf466d042` | [MIT](https://github.com/FoundationAgents/MetaGPT/blob/11cdf466d042aece04fc6cfd13b28e1a70341b1f/LICENSE) | Worker `LLMConfig` bilan `LLM.aask()` chaqiradi. MetaGPT software-company vositalari alohida yuqori darajali ishlash rejimidir. |
| [AG2](https://github.com/ag2ai/ag2/tree/920e6ead5f430318a3c9c746059a08085a27be1a) | `920e6ead5f43` | [Apache-2.0](https://github.com/ag2ai/ag2/blob/920e6ead5f430318a3c9c746059a08085a27be1a/LICENSE) | Worker `Agent.ask()` va `OpenAICompletionsConfig` orqali javob oladi. |
| [Swarms](https://github.com/kyegomez/swarms/tree/90d4807640f5d82803abad33b287c11cd908ac43) | `90d4807640f5` | [Apache-2.0](https://github.com/kyegomez/swarms/blob/90d4807640f5d82803abad33b287c11cd908ac43/LICENSE) | Worker `swarms.Agent.run()` orqali bitta chegaralangan iteratsiyada javob oladi. |
| [Google ADK](https://github.com/google/adk-python/tree/de1d3079e8968e5e970ec146e5963ecbe68a5b7a) | `de1d3079e896` | [Apache-2.0](https://github.com/google/adk-python/blob/de1d3079e8968e5e970ec146e5963ecbe68a5b7a/LICENSE) | Worker `Agent`, `LiteLlm` va `InMemoryRunner` orqali bitta sessiyada javob oladi. |
| [Mastra](https://github.com/mastra-ai/mastra/tree/2e7416cc6554f399d28ccdc58e39ab2e7af78b4e) | `2e7416cc6554` | [Apache-2.0; ee/ alohida](https://github.com/mastra-ai/mastra/blob/2e7416cc6554f399d28ccdc58e39ab2e7af78b4e/LICENSE.md) | Mastra serveridagi agent identifikatori bilan `/api/agents/.../generate` orqali matnli ishni bajarish. |
| [LiteLLM](https://github.com/BerriAI/litellm/tree/b38c7fb61d78b3d1da15ad2c3ccd142b5b22d4aa) | `b38c7fb61d78` | [MIT; enterprise/ alohida](https://github.com/BerriAI/litellm/blob/b38c7fb61d78b3d1da15ad2c3ccd142b5b22d4aa/LICENSE) | LiteLLM proxy'ning `/v1` profilini agent va prompt taqqoslashda ishlatish. |
| [Portkey Gateway](https://github.com/Portkey-AI/gateway/tree/669825cbe89ee51569918b8f78a9db486fd69dd4) | `669825cbe89e` | [MIT](https://github.com/Portkey-AI/gateway/blob/669825cbe89ee51569918b8f78a9db486fd69dd4/LICENSE) | Self-hosted Gateway uchun `/v1`, provayder identifikatori va serverda saqlangan provayder kaliti. Office va Portkey uchun boshqa portlardan foydalaning. |
| [Ollama](https://github.com/ollama/ollama/tree/b8db8d5b5c8daedbbef7bb9ace2221a38bc384c2) | `b8db8d5b5c8d` | [MIT](https://github.com/ollama/ollama/blob/b8db8d5b5c8daedbbef7bb9ace2221a38bc384c2/LICENSE) | Lokal modellarni ro‘yxatlash, nomlangan profil yaratish, inference, shaxsiy hujjat bo‘yicha savol va ko‘nikma taklifi. |
| [LocalAI](https://github.com/mudler/LocalAI/tree/bb421089ecc58c1be557440effb22f720db351f0) | `bb421089ecc5` | [MIT](https://github.com/mudler/LocalAI/blob/bb421089ecc58c1be557440effb22f720db351f0/LICENSE) | LocalAI `/v1` serverini model profili sifatida ishlatish. Tasvir/audio modeli uchun native LocalAI interfeysidan foydalaniladi. |
| [LibreChat](https://github.com/LibreChat-AI/LibreChat/tree/d4e85d2205c78413ee27d631d7e3b7313556f21d) | `d4e85d2205c7` | [MIT](https://github.com/LibreChat-AI/LibreChat/blob/d4e85d2205c78413ee27d631d7e3b7313556f21d/LICENSE) | Tanlangan profildan `librechat.yaml` yaratish. API kaliti uchun muhit o‘zgaruvchisi qoldiriladi. |

## Birinchi agent vazifasi

1. **Ochiq kod markazi → Lokal modellar** orqali kompyuterdagi Ollama modelini tanlab profil yarating.
2. **City Accountants xonalari** buyrug‘i AI Department ichiga Buxgalteriya, Tarjima va Hujjatlar xonalarini qo‘shadi. Har bir xonaga rahbar va mutaxassis yaratiladi. Takroriy bosish dublikat yaratmaydi.
3. Agent kartasida profilni biriktiring. **Ochiq kod markazi → Agentga topshiriq** orqali matnli vazifa bering. Natija va xatolar Kanban va agent tarixiga yoziladi.
4. **Loyihani ochish → Kod bo‘yicha qidirish** orqali fayl tanlang. Qidiruv fayl yo‘li bo‘yicha ishlaydi. Lokal model faylning dastlabki 16 000 belgisiga asoslanib yo‘riqnoma taklif qiladi. Uni **Skill va xotira** sahifasida ko‘rib chiqing. Taklifda Git commit, blob, fayl manzili va model saqlanadi.

## Modellar

Ollama modellarini o‘rnatish uchun misollar:

```powershell
ollama pull qwen3-vl:8b-instruct
ollama pull gemma3:1b
ollama pull deepseek-r1:1.5b
ollama list
```

Qwen, Gemma va DeepSeek oilalarida turli hajm, imkoniyat va foydalanish shartlari bor. Har bir server o‘zi yuklagan aniq modelni ko‘rsatadi. [Qwen](https://ollama.com/library/qwen3-vl), [Gemma](https://ollama.com/library/gemma3:1b), [DeepSeek](https://ollama.com/library/deepseek-r1:1.5b).

## Native xizmatlar

**Sozlamalar** sahifasida xizmatning server manzili, kaliti va identifikatorini kiriting. ChatDev uchun Model ID maydoniga joylashtirilgan YAML fayl nomi, Sim va Langflow uchun flow ID, Mastra uchun agent ID kiritiladi. Bu xizmatlar uchun URL ildiz manzili bo‘ladi. OpenAI-compatible xizmatlar uchun model API prefiksini, odatda `/v1`, kiriting. **Ulanishni sinash** shu profilda haqiqiy so‘rovni bajaradi. Pulli akkaunt ulanganda provayder tarifiga muvofiq foydalanish hisoblanishi mumkin.

Tashqi interfeysni to‘g‘ridan-to‘g‘ri ochish uchun Office serveridagi `.env` fayliga `OFFICE_APP_<ID>_URL` qiymatini qo‘shib, serverni qayta ishga tushiring. ID bosh harf bilan yoziladi va defis o‘rniga pastki chiziq qo‘yiladi. Masalan, `OFFICE_APP_PIXEL_OFFICE_URL=http://127.0.0.1:3300`. Edict, Kandev va Pixel Office monitoringi uchun `OFFICE_APP_<ID>_TOKEN` orqali ixtiyoriy bearer token beriladi. Xizmatda bearer autentifikatsiya yoqilgan bo‘lsa, uning tegishli tokeni kerak. Profil kalitlari va monitoring tokenlari brauzerga berilmaydi.

Edict'ning asl GET handlerini o‘z namuna vazifalari bilan sinash uchun:

```powershell
npm run projects -- checkout edict
python scripts/edict-demo.py
```

Test xizmati `127.0.0.1:17891/api/live-status` da ishlaydi. To‘liq Edict serverini native sozlash tartibi yuqoridagi pinlangan README'da. Demo serverda faqat demo holatini o‘qish mumkin.

LibreChat eksportida bir model endpointi va server muhiti orqali beriladigan kalit uchun joy yoziladi. Faylni LibreChat konfiguratsiyasi sifatida ulang. Konteyner boshqa kompyuter yoki tarmoqda bo‘lsa, `baseURL` o‘sha konteynerdan yetib boriladigan manzil bo‘lishi kerak. CompanyOS eksportini ko‘rsatilgan skill papkasiga joylashtiring. Bu ikki amal fayl yaratadi, tashqi xizmatga ma’lumot jo‘natmaydi.

## Python worker

Har bir freymvorkni alohida Python virtual muhitida ishlating. Windows uchun Python 3.11 bu SDK'larning versiya talablariga mos keladi. PowerShell'da Office serverini ishga tushiring. Ikkinchi terminalda bitta worker uchun:

```powershell
py -3.11 -m venv data/venvs/ag2
data/venvs/ag2/Scripts/python.exe -m pip install "ag2[openai]==1.3.2"
npm run sdk -- ag2 ./data/venvs/ag2/Scripts/python.exe qwen3-vl:8b-instruct
```

Worker alohida loopback portni tinglaydi. Buyruq autentifikatsiya tokenini lokal ma’lumotlar papkasida yaratadi va Office profilini ro‘yxatdan o‘tkazadi. Xuddi shu worker qayta ishga tushsa profil qayta ishlatiladi. Agentga bu nomlangan profilni tanlang. Worker yopilsa so‘rov xato qaytaradi. Xizmatga boshqa port kerak bo‘lsa `OFFICE_WORKER_PORT` ni belgilang. Ushbu buyruq hostda ishlaydigan parolli Office va uning lokal Ollama ulanishini ishlatadi.

| Worker ID | Alohida muhitga o‘rnatish uchun pip argumenti | Standart port |
| --- | --- | --- |
| autogen | `"autogen-agentchat==0.7.5" "autogen-ext[openai]==0.7.5"` | 8910 |
| crewai | `"crewai==1.15.41"` | 8911 |
| metagpt | `./upstream/projects/metagpt` (avval checkout, Python 3.11) | 8912 |
| ag2 | `"ag2[openai]==1.3.2"` | 8913 |
| swarms | `"swarms==17.0.3"` | 8914 |
| google-adk | `"google-adk==2.14.1" "litellm>=1.84,<1.106.3"` | 8915 |

Har bir SDK uchun `npm run sdk -- <id> <python-exe> <model>` ishlatiladi. Boshqa muhitda worker'ni qo‘lda ishga tushirish uchun `workers/sdk.py` faylida ko‘rsatilgan `OFFICE_WORKER_*` sozlamalarini bering. Manba kodini yuklash, bog‘liqliklarni o‘rnatish va native xizmatni ishga tushirish alohida amallardir. Haqiqiy chaqiruv va test darajalari [VERIFICATION.md](VERIFICATION.md) faylida.


## Albert Agent Space 0.4.0

[Muratify jonli demo](https://muratify.com/products/agentspace#live-demo) sintetik jamoa ishini ko‘rsatadi. Albert xaritasida kursorni vazifasi bor agent ustiga olib boring yoki personajni bosing. Kartasidan bevosita shu agentga yangi topshiriq yuborish mumkin. Muratify repozitori yuklanganda loyiha kartasidagi Mahsulot, Tadqiqot va Kontent tugmalari asl JSON andozasidan xona, rahbar, rollar va qabul mezonlarini yaratadi. Takroriy import mavjud sozlamalarni saqlaydi.

21-loyiha [Muratify/agentspace](https://github.com/Muratify/agentspace/tree/e0067fafc5864b9c747fb2fbf0f3706d74024abb) jamoa andozalari va ko‘nikmalar bo‘yicha ommaviy hujjatlardir. Ushbu mahsulotning dastur kodi yopiq. Albert o‘zining original pikselli mebeli, personajlari, xona tanlovi va backendga ulangan ofis xaritasidan foydalanadi. Muratify hujjatlari alohida Git checkout orqali ochiladi.

Sim manbasi v0.9.62 commit 27bb781a61a8d219cfb6ec6877bf691c930fe3c3 bo‘yicha tanlangan. Ulangan Sim serverida workflow yarating va deploy qiling. Ofis sozlamalarida Sim profili uchun Sim bazaviy manzilini, workflow ID va tegishli API kalitini kiriting. Profilni agentga biriktirib topshiriq bering. Sim serverini Docker bilan alohida ishga tushirish uchun original repo hujjatlaridan foydalaning.


## New office sources in 0.8.0

| Project | Commit | License |
| --- | --- | --- |
| [My Virtual Office](https://github.com/eliautobot/my-virtual-office/tree/6721f84375350c06b281c63fe0e13638ac71f274) | 6721f84375350c06b281c63fe0e13638ac71f274 | AGPL-3.0 |
| [OpenClaw Pixel Agents](https://github.com/SweetSophia/openclaw-pixel-agents/tree/c8ad068639626ac59dd8280c2acae011ec6e450a) | c8ad068639626ac59dd8280c2acae011ec6e450a | MIT |
| [Agent Office 3D](https://github.com/Munizada/agent-office/tree/228080bc0a8786b19e3eceebf416e2ceb02b3a16) | 228080bc0a8786b19e3eceebf416e2ceb02b3a16 | MIT |
| [Claw3D](https://github.com/iamlukethedev/claw3d/tree/51337f7f250459af61a7cf92b7b0015d59faed5c) | 51337f7f250459af61a7cf92b7b0015d59faed5c | MIT |
| [Pixel Claw](https://github.com/monkeystar0/pixel-claw/tree/a9185169ccdd72794ee52832849881e4ec3cda37) | a9185169ccdd72794ee52832849881e4ec3cda37 | MIT |

Runtime reuse is described in [OFFICE-RUNTIME.md](third-party/OFFICE-RUNTIME.md). All five full source trees are checked out under upstream/projects. The ZIP contains selected original files and the runtime code. Native service configuration is separate from the reused visual and navigation code.
