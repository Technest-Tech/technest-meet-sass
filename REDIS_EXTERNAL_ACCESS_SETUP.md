# Redis External Access Configuration

## Problem
The egress services running locally need to connect to production Redis instances, but Redis is currently bound to `localhost` (127.0.0.1), making it inaccessible from external networks.

## Solution
Configure Redis on both production servers to listen on all interfaces (0.0.0.0) and allow external access.

## Steps for Server 1 (178.128.78.195)

### 1. Edit Redis Configuration
```bash
ssh root@178.128.78.195
sudo nano /etc/redis/redis.conf
# or
sudo nano /etc/redis.conf
```

### 2. Update Bind Address
Find the line:
```conf
bind 127.0.0.1
```

Change it to:
```conf
bind 0.0.0.0
```

Or comment it out (Redis will bind to all interfaces by default):
```conf
# bind 127.0.0.1
```

### 3. Configure Protected Mode (Optional but Recommended)
If you want to add password protection:
```conf
protected-mode yes
requirepass your-strong-password-here
```

If you want to allow access without password (less secure, but simpler):
```conf
protected-mode no
```

### 4. Restart Redis
```bash
sudo systemctl restart redis
# or
sudo systemctl restart redis-server
```

### 5. Verify Redis is Listening on All Interfaces
```bash
sudo netstat -tlnp | grep 6379
# Should show: 0.0.0.0:6379 (not just 127.0.0.1:6379)
```

### 6. Configure Firewall (if enabled)
```bash
# For UFW
sudo ufw allow from YOUR_LOCAL_IP to any port 6379
# Or allow from your entire local network
sudo ufw allow from 192.168.0.0/16 to any port 6379

# For firewalld
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_LOCAL_IP" port port="6379" protocol="tcp" accept'
sudo firewall-cmd --reload

# For iptables
sudo iptables -A INPUT -p tcp -s YOUR_LOCAL_IP --dport 6379 -j ACCEPT
```

## Steps for Server 2 (167.99.107.128)

Repeat the same steps on Server 2:

```bash
ssh root@167.99.107.128
# Follow the same steps as Server 1
```

## Security Considerations

1. **Firewall Rules**: Only allow access from trusted IPs (your local development machine)
2. **Password Protection**: Consider enabling Redis password authentication
3. **VPN/Tunnel**: For better security, use a VPN or SSH tunnel instead of exposing Redis publicly
4. **Network Isolation**: If possible, use a private network/VPC for Redis access

## Alternative: SSH Tunnel (More Secure)

If you don't want to expose Redis publicly, you can use SSH tunnels:

### For Server 1:
```bash
ssh -L 6379:localhost:6379 root@178.128.78.195
```

Then update `egress-config-server1.yaml`:
```yaml
redis:
  address: 127.0.0.1:6379  # Local tunnel endpoint
```

### For Server 2:
```bash
ssh -L 6380:localhost:6379 root@167.99.107.128
```

Then update `egress-config-server2.yaml`:
```yaml
redis:
  address: 127.0.0.1:6380  # Local tunnel endpoint (different port to avoid conflict)
```

## Verification

After configuring Redis, test the connection:

```bash
# From your local machine
redis-cli -h 178.128.78.195 -p 6379 ping
# Should return: PONG

redis-cli -h 167.99.107.128 -p 6379 ping
# Should return: PONG
```

## Current Egress Configuration

The egress services are already configured to use production Redis:

- **egress-server1**: `178.128.78.195:6379`
- **egress-server2**: `167.99.107.128:6379`

Once Redis is configured for external access, restart the egress services:

```bash
docker compose restart egress-server1 egress-server2
```

## Troubleshooting

### Connection Refused
- Check Redis is running: `sudo systemctl status redis`
- Check Redis is listening on 0.0.0.0: `sudo netstat -tlnp | grep 6379`
- Check firewall rules: `sudo ufw status` or `sudo firewall-cmd --list-all`

### Connection Timeout
- Check firewall is allowing connections from your IP
- Check network connectivity: `ping 178.128.78.195`
- Check if port 6379 is blocked by ISP or network

### Authentication Required
- If Redis has password protection, update egress config:
```yaml
redis:
  address: 178.128.78.195:6379
  password: your-redis-password
```

