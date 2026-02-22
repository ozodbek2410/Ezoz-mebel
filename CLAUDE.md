# EZOZ MEBEL - Savdo Boshqaruv Tizimi

## Loyiha haqida
MDF listlar savdosi, xizmatlar, kassa, moliya va ishchilar boshqaruv tizimi.
Web App + PWA. Lokal tarmoqda (LAN) ishlaydi.
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
npm run dev:web      # Frontend dev server (port 5173, proxy -> 3000)
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

### Real-time
- Socket.io rooms: `room:sales`, `room:service`, `room:workshop`, `room:boss`, `room:stock`
- Event nomlanishi: `module:action` (masalan: `sale:created`, `stock:updated`)
- Har bir mutation dan keyin tegishli room larga emit qilinsin

### Valyuta
- Barcha narxlar UZS + USD da saqlanadi (ikki ustun)
- Kurs har kuni login paytida kiritiladi
- UZS rangi: `text-red-600` (qizil), USD rangi: `text-blue-600` (ko'k)
- `convertToUzs()`, `convertToUsd()` — `@ezoz/shared/utils/currency`

## Foydalanuvchi Rollari va Ruxsatlar
- **BOSS** — to'liq ruxsat (barcha modullar)
- **CASHIER_SALES** — savdo kassasi, mijozlar (read/create), mahsulotlar (read), ombor (read), chek, xarajat (o'z kassasi), hisobot (o'z kassasi)
- **CASHIER_SERVICE** — xizmat kassasi, mijozlar (read/create), mahsulotlar (read), workshop (read), chek, xarajat (o'z kassasi), hisobot (o'z kassasi)
- **MASTER** — faqat workshop vazifalari (o'zi), rasm yuklash

## DB Connection
- `DATABASE_URL=postgresql://postgres:2410@localhost:5432/ezoz_mebel`
- Schema: `apps/server/prisma/schema.prisma`

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

## Git
- Commit message: ingliz tilida, qisqa va aniq
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- Commit qilishdan oldin so'ra
