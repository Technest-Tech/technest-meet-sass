#!/bin/bash
cd /home/newmeet/app
sudo certbot renew --quiet
sudo cp /etc/letsencrypt/live/api.newmeet.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/api.newmeet.com/privkey.pem ./ssl/key.pem
sudo chown -R newmeet:newmeet ./ssl
docker-compose -f docker-compose.prod.yml restart nginx
