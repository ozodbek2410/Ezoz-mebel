# EZOZ MEBEL - Savdo Boshqaruv Tizimi

## Loyiha haqida
MDF listlar savdosi, xizmatlar, kassa, moliya va ishchilar boshqaruv tizimi.
Web App + PWA. Lokal tarmoqda (LAN) va internet orqali ishlaydi.
Til: O'zbek (UI), Ingliz (kod, comments, git).

## Tech Stack
- **Frontend:** React 19 + TypeScript (strict) + Vite 6 + TailwindCSS 4 + TanStack Router/Query/Table + Zustand 5 + Socket.io-client + Zod + React Hook Form + Recharts + Lucide Icons
- **Backend:** Fastify 5 + tRPC 11 + Prisma 6 + PostgreSQL 18 + Socket.io 4 + JWT + bcrypt + sharp
- **Shared:** @ezoz/shared (Zod schemas + TypeScript types + constants + utils)
- **Monorepo:** npm workspaces

## Loyiha strukturasi
```
packages/shared/    - @ezoz/shared (types, schemas, constants, utils)
apps/server/        - @ezoz/server (Fastify + tRPC + Prisma + Socket.io)
apps/web/           - @ezoz/web (React + Vite + TailwindCSS + PWA)
```

## Buyruqlar
```bash
npm run dev:server   # Backend dev server (port 3000)
npm run dev:web      # Frontend dev server (port 5173, proxy -> VPS yoki localhost)
npm run db:migrate   # Prisma migration
npm run db:seed      # Seed data (default users, warehouses, categories)
npm run db:studio    # Prisma Studio (DB GUI)
npm run build        # Production build
```

## Muhim Arxitektura Qoidalari

### TypeScript
- `strict: true` — MAJBURIY
- `any` — TAQIQLANGAN, hech qachon ishlatilmasin
- `noUncheckedIndexedAccess: true` — array/object access xavfsiz bo'lsin
- Barcha funksiya parametrlari va return typelar aniq bo'lsin
- `as` type assertion — faqat mantiqiy joylarda, minimal ishlatish

### React
- Functional component + hooks FAQAT, class component TAQIQLANGAN
- Custom hook nomi `use` bilan boshlansin
- Katta komponentlarni mayda qismlarga bo'l (max 200 qator)
- `useEffect` ichida cleanup funksiyani DOIM yoz
- Prop types uchun `interface` ishlatilsin (type emas)

### TailwindCSS
- Inline style TAQIQLANGAN
- Takroriy class kombinatsiyalarni `@layer components` da utility class sifatida yoz (`app.css`)
- Rang sxemasi `@theme` da aniqlangan — custom ranglar shu yerdan olinsin
- Responsive: `mobile-first` (default mobile, `md:` tablet, `lg:` desktop)

### Validatsiya
- Zod schemalar `packages/shared/src/schemas/` da yozilsin
- Frontend VA backend bir xil schemalardan foydalansin
- Form validatsiya: `@hookform/resolvers/zod` + React Hook Form

### State Management
- **Server state:** TanStack Query (fetch, cache, invalidate)
- **Client state:** Zustand (auth, UI, currency)
- **Real-time:** Socket.io events -> TanStack Query invalidation

### API
- tRPC routerlar: `apps/server/src/trpc/routers/`
- Permission middleware: `protectedProcedure`, `bossProcedure`, `cashierSalesProcedure`, `cashierServiceProcedure`, `masterProcedure`
- Barcha pul operatsiyalari `Decimal(18,2)` da saqlansin

### Xodim = Foydalanuvchi (Employee + User birlashtirilgan)
- `Employee` model YO'Q — `User` modelida: `baseSalaryUzs`, `bonusPerJob`, `phone`
- `Advance`, `JobRecord`, `SalaryPayment` — hammasi `userId` orqali `User` ga bog'langan
- Yangi xodim = yangi foydalanuvchi (`auth.createUser` orqali)
- `employee.router.ts` — `ctx.db.user` ishlatadi (employee emas)
- Frontend: Xodimlar sahifasi = foydalanuvchilar ro'yxati (bitta jadval)

### Telefon raqam input
- `PhoneInput` komponenti (`components/ui/PhoneInput.tsx`) — barcha telefon inputlar uchun
- Format: `+998 (XX) XXX XX-XX` — avtomatik formatlanadi
- `+998` prefiksi doim ko'rinadi, o'chirib bo'lmaydi
- Saqlangan qiymat: `+998XXXXXXXXX` (raw, DB ga shu ketadi)
- Backspace/Delete formatlash belgilarini o'tkazib yuboradi

### Rasm yuklash
- `sharp` kutubxonasi orqali kompressiya qilinadi (`apps/server/src/routes/upload.ts`)
- Mahsulot rasmlari: max 1200x1200, WebP 80%
- Banner rasmlari: max 1920x1080, WebP 85%

### Real-time
- Socket.io rooms: `room:sales`, `room:service`, `room:workshop`, `room:boss`, `room:stock`
- Event nomlanishi: `module:action` (masalan: `sale:created`, `stock:updated`)
- Har bir mutation dan keyin tegishli room larga emit qilinsin

### Valyuta
- Barcha narxlar UZS + USD da saqlanadi (ikki ustun)
- Kurs **avtomatik** CBU.uz (Markaziy Bank) API'dan olinadi — har safar `loadRate()` chaqirilganda
- CBU ishlamasa, DB'dagi oxirgi saqlangan kurs fallback sifatida ishlatiladi
- `currency.setRate` mutation mavjud (qo'lda override qilish uchun, lekin asosiy manba CBU)
- Kurs `ExchangeRate` jadvalida kunlik saqlanadi (`date` unique)
- Kurs o'zgarganda Socket.io orqali barcha clientlarga broadcast qilinadi (`currency:rateChanged`)
- Dashboard'da "Bugungi kurs: 1$ = XX,XXX so'm" ko'rsatiladi
- UZS rangi: `text-red-600` (qizil), USD rangi: `text-blue-600` (ko'k)
- `convertToUzs()`, `convertToUsd()` — `@ezoz/shared/utils/currency`
- Store: `currency.store.ts` (Zustand) — `rate`, `loadRate()`, `setRate()`

## Foydalanuvchi Rollari va Ruxsatlar
- **BOSS** — to'liq ruxsat (barcha modullar)
- **CASHIER_SALES** — savdo kassasi, mijozlar (read/create), mahsulotlar (read), ombor (read), chek, xarajat (o'z kassasi), hisobot (o'z kassasi)
- **CASHIER_SERVICE** — xizmat kassasi, mijozlar (read/create), mahsulotlar (read), workshop (read), chek, xarajat (o'z kassasi), hisobot (o'z kassasi)
- **MASTER** — faqat workshop vazifalari (o'zi), rasm yuklash

## DB Connection
- **Local:** `DATABASE_URL=postgresql://postgres:2410@localhost:5432/ezoz_mebel`
- **VPS:** `DATABASE_URL=postgresql://ezoz:ezoz2410@localhost:5432/ezoz_mebel`
- Schema: `apps/server/prisma/schema.prisma`

## Deployment (VPS)
- **VPS:** `ssh root@167.86.95.237`
- **Domain:** https://mebel.biznesjon.uz (SSL — Let's Encrypt)
- **Loyiha joyi:** `/var/www/ezoz-mebel`
- **Port:** 3005 (3001 boshqa loyiha band!)
- **Process manager:** PM2 (`ecosystem.config.cjs`, tsx interpreter)
- **Web server:** Nginx (reverse proxy + SPA fallback + static)
- **Upload papka:** `/var/www/ezoz-mebel/uploads`

### Deploy qilish tartibi
```bash
# 1. Lokal: GitHub ga push
git add . && git commit -m "feat: ..." && git push

# 2. VPS ga kirish
ssh root@167.86.95.237

# 3. Pull va build
cd /var/www/ezoz-mebel
git pull
npm install
npx prisma generate
npx prisma migrate deploy   # Agar yangi migration bo'lsa
npm run build               # Frontend build

# 4. Server restart
pm2 restart ezoz-mebel
```

### Nginx config
- Fayl: `/etc/nginx/sites-available/ezoz-mebel`
- SPA fallback: `try_files $uri $uri/ /index.html`
- Proxy: `/trpc`, `/api`, `/uploads`, `/socket.io` → `localhost:3005`

### PM2 config (`ecosystem.config.cjs`)
- `tsx` interpreter (ESM module — `moduleResolution: "bundler"` tufayli `node dist/` ishlamaydi)
- `cwd: /var/www/ezoz-mebel/apps/server`
- `script: src/index.ts`

## Vite Proxy (Dev)
- Fayl: `apps/web/vite.config.ts` → `server.proxy`
- **VPS bilan test:** target = `https://mebel.biznesjon.uz` (hozirgi holat)
- **Lokal backend bilan:** target = `http://localhost:3000`
- Proxy yo'llari: `/trpc`, `/api`, `/uploads`, `/socket.io`

## Fayl Nomlash Konventsiyasi
- Komponentlar: `PascalCase.tsx` (masalan: `CustomerList.tsx`, `SaleForm.tsx`)
- Hooks: `camelCase.ts` (masalan: `useAuth.ts`, `useSocket.ts`)
- Store: `kebab-case.store.ts` (masalan: `auth.store.ts`)
- tRPC routerlar: `kebab-case.router.ts` (masalan: `auth.router.ts`)
- Zod schemalar: `kebab-case.schema.ts` (masalan: `customer.schema.ts`)
- Utillar: `camelCase.ts` (masalan: `currency.ts`)
- Constants: `camelCase.ts` (masalan: `roles.ts`)

## Import Qoidalari
- Named import: `import { X } from "module"` — DOIM
- `import *` — TAQIQLANGAN
- Path alias: `@/` -> `apps/web/src/`
- Shared: `@ezoz/shared`
- Relative: `./` yoki `../` faqat bir xil package ichida

## TAQIQLAR
- `any` type ISHLATMA
- `console.log` production'da QOLDIRMA
- Inline style ISHLATMA — faqat TailwindCSS
- Class component YOZMA — faqat functional + hooks
- Yangi dependency qo'shishdan oldin mavjudlarini tekshir
- README/docs fayl yaratma (agar so'ralmasa)
- Emoji ISHLATMA (agar so'ralmasa)
- Ortiqcha tushuntirma berma — qisqa va aniq

## Default Login (Seed)
- **Boss:** `boshliq` / `1234`
- **Kassir (savdo):** `kassir_savdo` / `1234`
- **Kassir (xizmat):** `kassir_xizmat` / `1234`
- **Usta:** `usta1` / `1234`

## Git
- Repo: https://github.com/ozodbek2410/Ezoz-mebel
- Commit message: ingliz tilida, qisqa va aniq
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- Commit qilishdan oldin so'ra
