# Cloudflare SSL Setup for academy.the-doable.com

## Current Status
- Domain: academy.the-doable.com
- Server IP: 152.42.249.147
- Cloudflare Error: 521 (Web server is down)

## Issue
Cloudflare is showing error 521, which means Cloudflare cannot connect to the origin server. This is likely because:
1. Cloudflare proxy is enabled (orange cloud)
2. SSL/TLS mode needs to be configured
3. Origin server needs proper SSL certificate

## Solutions

### Option 1: Use Cloudflare SSL (Recommended)
If Cloudflare proxy is enabled:
1. Go to Cloudflare Dashboard → SSL/TLS
2. Set SSL/TLS encryption mode to **"Full"** or **"Full (strict)"**
3. Ensure origin server has valid SSL certificate (self-signed works with "Full")
4. The domain will use Cloudflare's SSL certificate automatically

### Option 2: Disable Cloudflare Proxy
1. Go to Cloudflare Dashboard → DNS
2. Click on the orange cloud icon next to academy.the-doable.com
3. Change it to gray (DNS only, no proxy)
4. Then use Let's Encrypt certificate on the server

### Option 3: Get Let's Encrypt Certificate (If proxy disabled)
```bash
# On the server
cd /opt/almajd-meet
docker-compose stop nginx
certbot certonly --standalone -d academy.the-doable.com --non-interactive --agree-tos --email admin@the-doable.com
docker-compose up -d nginx
```

## Current Configuration
- Nginx is configured to use Let's Encrypt certificates
- Path: `/etc/letsencrypt/live/academy.the-doable.com/`
- If using Cloudflare proxy, you can use self-signed certificate with "Full" mode

## Next Steps
1. Check Cloudflare SSL/TLS settings
2. Ensure port 443 is accessible from Cloudflare
3. Verify DNS A record points to 152.42.249.147
4. Test connection: `curl -I https://academy.the-doable.com`
