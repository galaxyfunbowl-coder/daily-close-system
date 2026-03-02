# Daily Closing — Local-Only Web App

Εφαρμογή καθημερινού κλεισίματος για πολυ-τμήμα χώρο ψυχαγωγίας. Λειτουργεί **μόνο τοπικά**, χωρίς cloud, APIs ή analytics.

## Απαιτήσεις

- Windows 11
- Node.js 18+
- npm

## Εγκατάσταση (Windows 11)

1. **Ανοίξτε terminal** στο φάκελο του project:

   ```bash
   cd C:\Users\XATZI\daily-closing-app
   ```

2. **Εγκατάσταση dependencies:**

   ```bash
   npm install
   ```

3. **Δημιουργία βάσης και migrations:**

   ```bash
   npx prisma migrate dev
   ```

4. **Seed (admin χρήστης + προεπιλογές):**

   ```bash
   npm run db:seed
   ```

   Μετά το seed, συνδεθείτε με:
   - **Username:** `admin`
   - **Password:** `admin`

5. **Εκκίνηση εφαρμογής:**

   ```bash
   npm run dev
   ```

   Η εφαρμογή θα τρέχει στο **http://localhost:3000**.

**Σημείωση:** Το telemetry του Next.js είναι απενεργοποιημένο μέσω `.env.local` (`NEXT_TELEMETRY_DISABLED=1`).

---

## Πρόσβαση από κινητό στο τοπικό δίκτυο

1. **Βρείτε το local IP του laptop (Windows):**

   ```bash
   ipconfig
   ```

   Στο τμήμα **IPv4 Address** (συνήθως κάτω από "Wireless LAN adapter" ή "Ethernet adapter") θα δείτε π.χ. `192.168.1.100`.

2. **Ανοίξτε την εφαρμογή από το κινητό:**

   Στο browser του κινητού πληκτρολογήστε:

   ```
   http://192.168.1.100:3000
   ```

   (αντικαταστήστε με το δικό σας IP.)

3. **Windows Firewall — Private network:**

   Αν το κινητό δεν ανοίγει τη σελίδα, πιθανόν να μπλοκάρει το Windows Firewall. Επιτρέψτε το Node/Next.js στο **Private network**:

   - Ανοίξτε **Windows Security** → **Firewall & network protection** → **Allow an app through firewall**
   - Κάντε **Change settings** → **Allow another app** → **Browse**
   - Πηγαίνετε στο `C:\Program Files\nodejs\node.exe` (ή όπου έχετε εγκατεστημένο το Node) και προσθέστε το
   - Επιλέξτε **Private** (τουλάχιστον) και OK

   Εναλλακτικά, από **PowerShell (Run as Administrator)**:

   ```powershell
   New-NetFirewallRule -DisplayName "Next.js Daily Closing" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow -Profile Private
   ```

   (Διορθώστε το path στο `-Program` αν το Node είναι αλλού.)

---

## Δομή project

- **`/daily`** — Κεντρική οθόνη κλεισίματος (μία οθόνη = μία μέρα)
- **`/expenses`** — Καταχώρηση και προβολή εξόδων
- **`/admin`** — Διαχείριση Προσωπικού, Προμηθευτών, Αργιών, Κλεισιμάτων
- **`/dashboard`** — Σύνολα ανά μήνα, breakdowns, YoY, έλεγχος POS, Export CSV, Backup

## Βάση δεδομένων

- **SQLite:** `./data/app.db`
- Δεν στέλνονται δεδομένα πουθενά· όλα μένουν στο laptop σας.

## Backup & Export

- **Backup βάσης:** Στην οθόνη Dashboard, κουμπί **"Backup βάσης"**. Αντιγράφει το `./data/app.db` στο `./backups/` με timestamp (π.χ. `app-2026-02-25T21-49-40.db`).
- **Export μήνα σε CSV:** Στην οθόνη Dashboard, επιλέξτε μήνα και πατήστε **"Export μήνα σε CSV"**. Κατεβαίνει ένα CSV με έσοδα και έξοδα του μήνα.

---

## Σημειώσεις

- Ο κωδικός σας hashing γίνεται με bcrypt· τα sessions είναι httpOnly cookies.
- Δεν υπάρχουν τρίτοι auth providers· μόνο τοπικός admin λογαριασμός.
- Για production build: `npm run build` και μετά `npm start` (π.χ. για να τρέχει συνεχώς στο LAN).
