# Almajd Custom Room Links Implementation

## Overview

This implementation adds support for custom room links for the `almajd@admin.com` account, allowing rooms to be accessed via simple numeric links like `almajdmeet.org/1/h` instead of auto-generated 7-character links.

## Changes Made

### 1. Backend API Updates

#### `app/api/client/rooms/route.ts`
- Added `customRoomLink` field to the room creation schema
- Added validation to check if client email is `almajd@admin.com`
- If custom link is provided for almajd account:
  - Validates uniqueness within the same client
  - Uses custom link as both `hostLink` and `guestLink`
  - Sanitizes input (alphanumeric only, 1-50 characters)
- Falls back to auto-generation for other clients or when custom link is not provided

#### `app/api/client/rooms/check-name/route.ts`
- Added support for `customRoomLink` parameter
- Validates custom link format (alphanumeric, 1-50 characters)
- Checks availability within the same client
- Returns availability status

#### `app/api/admin/rooms/route.ts`
- Added `customRoomLink` and `clientId` support for admin-created rooms
- Validates that custom links are only used for almajd account
- Applies same validation logic as client API

### 2. Frontend Updates

#### `app/client/rooms/RoomsManagementClient.tsx`
- Added `customRoomLink` field to form state
- Added checkbox to toggle between auto-generate and custom link
- Custom room link field is only shown for `almajd@admin.com` account
- Added real-time validation for custom links
- Shows availability status while typing

### 3. Seeding Script

#### `scripts/seed-almajd-rooms.ts`
- Finds account with email `almajd@admin.com`
- Deletes all existing rooms for that client
- Creates 116 rooms with names "1" through "116"
- Each room uses its name as the room link (e.g., room "1" has link "1")
- Creates initial host and guest participants for each room

## Usage

### For Almajd Account

1. **Creating a Room with Custom Link:**
   - Log in as `almajd@admin.com`
   - Go to Rooms Management
   - Click "Create Room"
   - Check "استخدام رابط مخصص للغرفة" (Use custom room link)
   - Enter a custom link (e.g., "1", "2", "116")
   - The system will validate the link is available
   - Create the room

2. **Room Access URLs:**
   - Host: `almajdmeet.org/{customLink}/h`
   - Guest: `almajdmeet.org/{customLink}/g`
   - Observer: `almajdmeet.org/{customLink}/o` (if enabled)

### Seeding 116 Rooms

Run the seeding script to create 116 rooms (1-116) for the almajd account:

```bash
npm run db:seed:almajd
```

This will:
- Delete all existing rooms for almajd account
- Create 116 rooms with names "1" through "116"
- Each room will be accessible via `almajdmeet.org/{number}/h` or `/g`

## Validation Rules

- Custom room links must be unique within the same client
- Only alphanumeric characters allowed (a-z, A-Z, 0-9)
- Minimum length: 1 character
- Maximum length: 50 characters
- Numbers are treated as text (e.g., "1", "2", "116" are valid)

## Domain Configuration

After implementation, configure the domain `almajdmeet.org`:

### 1. DNS Configuration

Point `almajdmeet.org` to your server IP:
- A record: `almajdmeet.org` → `YOUR_SERVER_IP`
- A record: `www.almajdmeet.org` → `YOUR_SERVER_IP` (optional)

### 2. Nginx Configuration

Add server block for `almajdmeet.org` in your Nginx configuration:

```nginx
server {
    listen 80;
    server_name almajdmeet.org www.almajdmeet.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. SSL Certificate

Obtain SSL certificate for `almajdmeet.org`:

```bash
sudo certbot --nginx -d almajdmeet.org -d www.almajdmeet.org
```

Or if using Docker:

```bash
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly --standalone \
  -d almajdmeet.org -d www.almajdmeet.org
```

### 4. Update Nginx for HTTPS

After obtaining SSL certificate, update Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name almajdmeet.org www.almajdmeet.org;

    ssl_certificate /etc/letsencrypt/live/almajdmeet.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/almajdmeet.org/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name almajdmeet.org www.almajdmeet.org;
    return 301 https://$server_name$request_uri;
}
```

### 5. Restart Nginx

```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Or restart nginx
```

## Testing

1. **Test Custom Link Creation:**
   - Log in as `almajd@admin.com`
   - Create a room with custom link "test1"
   - Verify room is accessible at `almajdmeet.org/test1/h`

2. **Test Link Uniqueness:**
   - Try to create another room with the same custom link
   - Verify error message is shown

3. **Test Seeded Rooms:**
   - Run seeding script
   - Verify rooms 1-116 are created
   - Test access to `almajdmeet.org/1/h`, `almajdmeet.org/116/h`, etc.

## Notes

- Custom room links are only available for `almajd@admin.com` account
- Other clients continue to use auto-generated 7-character links
- The system maintains backward compatibility with existing rooms
- Room links are case-sensitive (treated as text, so "1" and "1" are the same)

