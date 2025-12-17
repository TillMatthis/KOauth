# Running Admin Setup in Docker

## Proper Solution

The admin setup script uses TypeScript and requires the container to be built with the scripts folder included.

### Step 1: Ensure Container Has Scripts

First, verify your container includes the scripts folder. The Dockerfile should copy them, but if your container was built before scripts were added, you need to rebuild:

```bash
cd /opt/KOauth
docker-compose build app
docker-compose up -d app
```

### Step 2: Run the Admin Setup Script

Once the container is rebuilt, run the script using one of these methods:

**Method 1: Using npm script (Recommended)**
```bash
docker-compose exec app npm run admin:setup your-email@example.com
```

**Method 2: Using npx tsx directly**
```bash
docker-compose exec app npx tsx scripts/setup-initial-admin.ts your-email@example.com
```

**Method 3: Using docker exec**
```bash
docker exec -it koauth-app npx tsx scripts/setup-initial-admin.ts your-email@example.com
```

### Step 3: With Environment Variable

If you have `INITIAL_ADMIN_EMAIL` set in your `.env` file:

```bash
docker-compose exec app npm run admin:setup
```

## Troubleshooting

### If you get "Cannot find module" error:

1. **Check if scripts folder exists in container:**
   ```bash
   docker exec koauth-app ls -la /app/scripts/
   ```

2. **If scripts folder is missing, rebuild:**
   ```bash
   docker-compose build app
   docker-compose up -d app
   ```

3. **Verify tsx is available:**
   ```bash
   docker exec koauth-app npx tsx --version
   ```

### If you get "User not found" error:

- Make sure you've signed up/logged in first at your KOauth instance
- Verify the email address matches exactly (case-sensitive)

### After running successfully:

1. Log out and log back in (or clear cookies)
2. Navigate to `/dashboard` - you should see the "Admin Panel" button
3. Or go directly to `/admin`

## Step-by-Step Process

1. **Make sure your containers are running:**
   ```bash
   docker-compose ps
   ```

2. **Ensure you have a user account:**
   - Visit `http://localhost:3002` (or your configured port)
   - Sign up or log in with your email

3. **Run the admin setup:**
   ```bash
   docker-compose exec app npx tsx scripts/setup-initial-admin.ts your-email@example.com
   ```

4. **Verify the output:**
   You should see:
   ```
   ✅ Admin setup successful!
      your-email@example.com is now an admin
   ```

5. **Refresh your browser session:**
   - Log out and log back in, or
   - Clear cookies and log in again
   - Navigate to `/dashboard` - you should see the "Admin Panel" button
   - Or go directly to `/admin`

## Troubleshooting

### If you get "User not found" error:
- Make sure you've signed up/logged in first
- Verify the email address matches exactly (case-sensitive)

### If you get "Permission denied" error:
- The container runs as non-root user `koauth`
- Make sure you're using `docker-compose exec` (not `docker exec` as root)

### If tsx is not found:
- Try using `npx tsx` explicitly
- Or rebuild the container: `docker-compose build app`

### Using docker exec directly:
If you prefer `docker exec` instead of `docker-compose exec`:

```bash
docker exec -it koauth-app npx tsx scripts/setup-initial-admin.ts your-email@example.com
```

## Environment Variables

The script will automatically use the `DATABASE_URL` from the container's environment, which is configured to connect to the `postgres` container.
