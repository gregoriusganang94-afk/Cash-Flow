# KasSiklus — Cash Flow Periode 25 (Firestore + GitHub + Vercel)

Aplikasi web manajemen arus kas dengan pola siklus tanggal **25 November – 24 Desember** dan seterusnya, terhubung ke **Cloud Firestore** dan **GitHub Repository**.

## Fitur Utama
- **Siklus Otomatis Tanggal 25**: Pengelompokan transaksi dan carry-over saldo akhir → saldo awal antar periode.
- **Form Pemasukan & Pengeluaran**: Input, edit, dan hapus transaksi real-time ke Firestore.
- **Tabel Ringkasan & Grafik Batang Bulanan**: Pemantauan saldo awal, pemasukan, pengeluaran, dan saldo akhir per siklus.
- **Integrasi GitHub Repository**: Cek repositori, lihat riwayat commit, impor JSON, dan commit snapshot langsung via GitHub OAuth.

## Cara Publish ke GitHub & Vercel (Auto-Deploy)

### 1. Buat Repository GitHub & Push Kode
Buat repository baru di [GitHub](https://github.com/new) (misalnya `kassiklus-cashflow`), lalu jalankan di folder proyek ini:

```bash
git remote add origin https://github.com/<username-github-anda>/kassiklus-cashflow.git
git branch -M main
git push -u origin main
```

### 2. Deploy ke Vercel
1. Buka [vercel.com/new](https://vercel.com/new) dan pilih **Import Git Repository** (`kassiklus-cashflow`).
2. Vercel otomatis membaca `vercel.json` (`npm run build` → `dist/`, dan `/api/*` → `api/index.ts`).
3. *(Opsional untuk GitHub OAuth Push)* Tambahkan **Environment Variables** di Project Settings Vercel:
   - `APP_URL` = `https://<nama-project-anda>.vercel.app`
   - `GITHUB_CLIENT_ID` = Client ID GitHub OAuth App
   - `GITHUB_CLIENT_SECRET` = Client Secret GitHub OAuth App
4. Klik **Deploy**.

### 3. Tambahkan Domain Vercel ke Firebase Auth
Agar login Google bekerja di domain Vercel Anda:
1. Buka [Firebase Console](https://console.firebase.google.com/project/copper-partition-23kqt/authentication/settings).
2. Pada bagian **Authorized domains**, klik **Add domain** dan masukkan domain Vercel Anda (contoh: `<nama-project-anda>.vercel.app`).

### 4. Update Perubahan Selanjutnya
Setiap kali ada perubahan kode, cukup commit dan push ke GitHub — Vercel akan otomatis mem-build dan memperbarui aplikasi produksi:

```bash
git add .
git commit -m "Update fitur cash flow"
git push
```
