# 🚀 NewMeet Quick Deployment Guide

## 📋 Prerequisites
- Digital Ocean account
- Domain name (for subdomain)
- Docker installed locally
- Git repository

---

## 🚀 Quick Start (5 Steps)

### 1. **Setup Git Repository**
```bash
cd /Users/ahmedomar/Documents/NewMeet
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/newmeet.git
git push -u origin main
```

### 2. **Create Digital Ocean Droplet**
- Create Ubuntu 22.04 droplet (2GB RAM minimum)
- Add SSH key
- Note the IP address

### 3. **Deploy to Server**
```bash
# SSH into your server
ssh root@YOUR_DROPLET_IP

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Clone and deploy
git clone https://github.com/yourusername/newmeet.git
cd newmeet
./deploy.sh
```

### 4. **Setup Domain & SSL**
```bash
# Configure DNS: api.newmeet.com → YOUR_DROPLET_IP

# Get SSL certificate
sudo apt install certbot -y
sudo certbot certonly --standalone -d api.newmeet.com

# Copy certificates
sudo cp /etc/letsencrypt/live/api.newmeet.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/api.newmeet.com/privkey.pem ./ssl/key.pem
sudo chown -R newmeet:newmeet ./ssl

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### 5. **Build Flutter App**
```bash
cd newmeet_mobile
flutter build apk --release
flutter build ios --release
```

---

## 🌐 Production URLs

- **Backend API**: `https://api.newmeet.com`
- **Admin Panel**: `https://api.newmeet.com/admin/login`
- **Admin Login**: `admin@newmeet.com` / `admin123`

---

## 🔧 Management Commands

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🚨 Quick Troubleshooting

### Services not starting?
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### SSL issues?
```bash
sudo certbot renew --force-renewal
```

### API not responding?
```bash
curl -f https://api.newmeet.com/health
```

---

## ✅ Success Checklist

- [ ] Git repository created
- [ ] Digital Ocean droplet running
- [ ] Docker services started
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Backend API accessible
- [ ] Flutter app built
- [ ] Admin panel working

---

**🎉 Your NewMeet app is now live at https://api.newmeet.com!**