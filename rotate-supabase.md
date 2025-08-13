# SUPABASE CREDENTIAL ROTATION GUIDE

## ⚠️ CRITICAL: Read Before Starting
- JWT rotation will IMMEDIATELY break all connections
- Have this guide open alongside Supabase dashboard
- Be ready to update .env file within seconds

## Step 1: Prepare Your .env File
Open your .env file and have it ready to edit these lines:
```
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
DATABASE_URL=
```

## Step 2: Database Password First (Less Disruptive)
1. Go to: https://supabase.com/dashboard/project/laeyzrbtsbeylrjcttto
2. Click **Project Settings** (bottom left)
3. Click **Database** under Configuration
4. Click **"Reset database password"**
5. Enter a STRONG new password
6. Copy and update in .env:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_NEW_PASSWORD@db.laeyzrbtsbeylrjcttto.supabase.co:5432/postgres
   ```

## Step 3: Rotate API Keys (CAUSES DOWNTIME)
1. Stay in **Project Settings**
2. Click **API** under Configuration
3. Scroll to **JWT Settings** section
4. Click **"Generate new secret"** button
5. IMMEDIATELY copy the new keys shown:
   - Copy the **anon (public)** key
   - Copy the **service_role (secret)** key
6. Update .env IMMEDIATELY:
   ```
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...NEW_KEY
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...NEW_KEY
   ```

## Step 4: Restart Your Application
```bash
# Kill the current server
pkill -f "npm run dev"

# Restart with new credentials
PORT=5001 npm run dev
```

## Step 5: Verify Everything Works
1. Test database connection
2. Test authentication
3. Check API endpoints

## Alternative: New API Keys System (If Available)
If you see an option for "New API Keys" or "Publishable Keys":
1. Opt into the new system
2. Generate `sb_publishable_...` key (replaces anon key)
3. Generate `sb_secret_...` key (replaces service_role key)
4. These can be rotated without downtime!

## Emergency Contacts
- Supabase Support: https://supabase.com/support
- Status Page: https://status.supabase.com/

## Notes
- Old keys are IMMEDIATELY invalid after rotation
- Database restart takes 1-2 minutes
- All active connections will be dropped