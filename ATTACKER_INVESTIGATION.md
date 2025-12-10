# Attacker Investigation Report
**Date**: December 5, 2025  
**Attacker IP**: `45.76.155.14`

---

## Attacker Information

### IP Address Details

**IP**: `45.76.155.14`

**Whois Information**:
- **Organization**: The Constant Company, LLC (CHOOP-1)
- **Network Name**: CONSTANT
- **Registry**: ARIN (American Registry for Internet Numbers)
- **Location**: United States (based on IP registry)

**IP Information Service**:
- **ISP**: The Constant Company, LLC
- **Type**: Hosting/VPS Provider
- **ASN**: Likely a hosting provider or VPS service

### Attack Characteristics

1. **User Agent**: `python-requests/2.28.1`
   - Automated Python script
   - Not a legitimate browser
   - Clearly a bot/automated attack tool

2. **Attack Method**: HTTP POST requests to root endpoint (`/`)
   - Attempted command injection
   - Downloaded and executed malicious binary
   - Used `wget` to fetch payload from `http://45.76.155.14/vim`

3. **Attack Timeline**:
   - **First Attempt**: December 5, 2025, 10:43:10 UTC
   - **Second Attempt**: December 5, 2025, 10:43:13 UTC
   - **Additional Attempts**: December 5, 2025, 12:25:23-29 UTC

4. **Payload Server**: `http://45.76.155.14/vim`
   - Same IP as attacker
   - Hosted malicious binary (4.7MB)
   - Masqueraded as "vim" editor

---

## Who Is The Attacker?

### Analysis

**This is likely NOT a targeted attack against you specifically.**

**Evidence**:
1. **Automated Bot**: Uses `python-requests` library (common in automated scanners)
2. **Generic Attack Pattern**: POST to root endpoint is a common vulnerability scan
3. **Hosting Provider IP**: IP belongs to a hosting/VPS provider, not a residential connection
4. **Mass Scanning**: Likely scanning many servers for vulnerabilities

### Possible Scenarios

1. **Automated Vulnerability Scanner**
   - Bot scanning the internet for vulnerable servers
   - Found your server through automated discovery
   - Attempted common attack patterns

2. **Script Kiddie with VPS**
   - Rented VPS from hosting provider
   - Running automated attack scripts
   - Scanning for easy targets

3. **Organized Attack Group**
   - Part of larger botnet
   - Scanning for vulnerable servers
   - Building list of compromised hosts

4. **Competitor or Targeted Attack** (Less Likely)
   - Could be targeted if you have business competitors
   - But attack pattern suggests automated scanning

---

## How to Find More Information

### 1. Cloudflare Security Events (Once Active)

**Location**: Cloudflare Dashboard → Security → Events

**What to Look For**:
- All requests from `45.76.155.14`
- Attack patterns and signatures
- Blocked/challenged requests
- Timeline of attack attempts

**Steps**:
1. Go to Cloudflare Dashboard
2. Select `almajdmeet.org`
3. Navigate to: **Security** → **Events**
4. Filter by IP: `45.76.155.14`
5. Review all events from this IP

### 2. Server Logs Analysis

**Nginx Access Logs**:
```bash
# View all requests from attacker IP
grep "45.76.155.14" /var/log/nginx/access.log

# Or in Docker
docker logs nginx-proxy | grep "45.76.155.14"
```

**What to Check**:
- All HTTP requests from this IP
- Request patterns
- User agents
- Request paths
- Timestamps

### 3. Application Logs

**Next.js Backend Logs**:
```bash
docker logs newmeet-backend | grep -i -E '(45.76.155.14|wget|vim|exec)'
```

**What to Check**:
- Any command execution attempts
- Error messages
- Process creation logs

### 4. Network Traffic Analysis

**Check Outbound Connections**:
```bash
# Check if attacker made outbound connections
netstat -an | grep 45.76.155.14
# Or
ss -an | grep 45.76.155.14
```

### 5. Threat Intelligence Services

**Free Services**:
- **AbuseIPDB**: https://www.abuseipdb.com/check/45.76.155.14
- **VirusTotal**: https://www.virustotal.com/gui/ip-address/45.76.155.14
- **IPVoid**: https://www.ipvoid.com/ip/45.76.155.14
- **Shodan**: https://www.shodan.io/host/45.76.155.14

**What They Show**:
- Reputation score
- Previous abuse reports
- Associated malware
- Other attacks from this IP

### 6. Cloudflare Analytics (Once Active)

**Location**: Cloudflare Dashboard → Analytics

**Metrics to Review**:
- Requests by country
- Top threat types
- Blocked requests
- Challenge responses
- Bot score distribution

---

## How to Block and Monitor

### 1. Block IP in Cloudflare (Recommended)

**Steps**:
1. Go to Cloudflare Dashboard
2. Select `almajdmeet.org`
3. Navigate to: **Security** → **WAF** → **Tools**
4. Click **IP Access Rules**
5. Add rule:
   - **IP Address**: `45.76.155.14`
   - **Action**: Block
   - **Note**: "Attacker from Dec 5, 2025 incident"

### 2. Block IP in Nginx (Immediate)

Add to nginx configuration:
```nginx
# Block attacker IP
deny 45.76.155.14;
```

Then reload nginx:
```bash
docker exec nginx-proxy nginx -s reload
```

### 3. Create Firewall Rule in Cloudflare

**Steps**:
1. Go to: **Security** → **WAF** → **Firewall Rules**
2. Create new rule:
   - **Name**: "Block Known Attacker IP"
   - **Expression**: `(ip.src eq 45.76.155.14)`
   - **Action**: Block

### 4. Set Up Alerts

**Cloudflare Notifications**:
1. Go to: **Notifications**
2. Create alert for:
   - Security events
   - High threat score
   - Blocked requests

---

## Additional Investigation Steps

### 1. Check for Data Exfiltration

**Database Logs**:
```bash
# Check PostgreSQL logs for suspicious queries
# Look for unusual SELECT, UPDATE, or DELETE operations
```

**File System**:
```bash
# Check for new/modified files
find /app -type f -mtime -1 -ls
```

### 2. Check for Backdoors

**Process List**:
```bash
docker exec newmeet-backend ps aux
```

**Network Connections**:
```bash
docker exec newmeet-backend netstat -tuln
# Or
docker exec newmeet-backend ss -tuln
```

**Scheduled Tasks**:
```bash
docker exec newmeet-backend crontab -l
```

### 3. Review All POST Endpoints

**Check Application Code**:
- Review all POST handlers
- Look for command execution vulnerabilities
- Check input validation
- Review file upload handlers

---

## Reporting the Attack

### 1. Report to Hosting Provider

**The Constant Company, LLC**:
- Report abuse of their IP
- Provide evidence (logs, timestamps)
- Request IP investigation

**Contact Information**:
- Check ARIN whois for abuse contact
- Usually: abuse@[provider-domain]

### 2. Report to Authorities (If Needed)

**When to Report**:
- Data was stolen
- Financial loss occurred
- Personal information compromised
- Ongoing targeted attacks

**Who to Contact**:
- Local cybercrime unit
- FBI IC3 (if in US): https://www.ic3.gov
- Your country's cybercrime reporting center

### 3. Report to Threat Intelligence

**AbuseIPDB**:
- Report the IP as malicious
- Provide evidence
- Help protect others

---

## Prevention for Future

### 1. Enable Cloudflare Security Features

- ✅ WAF (Web Application Firewall)
- ✅ Bot Fight Mode
- ✅ Rate Limiting
- ✅ Firewall Rules
- ✅ IP Access Rules

### 2. Monitor Security Events

- Set up Cloudflare alerts
- Review security dashboard daily
- Monitor blocked requests
- Track threat scores

### 3. Fix Vulnerabilities

- Fix command injection vulnerability
- Add input validation
- Implement security headers
- Regular security audits

### 4. Implement Defense in Depth

- Multiple layers of security
- Server-side protections
- Application-level security
- Network-level protections

---

## Summary

**Attacker Profile**:
- **IP**: 45.76.155.14
- **Type**: Automated bot/scanner
- **Method**: Command injection via POST
- **Likelihood**: Mass scanning, not targeted

**Investigation Tools**:
1. Cloudflare Security Events (once active)
2. Server logs analysis
3. Threat intelligence services
4. Network traffic analysis

**Immediate Actions**:
1. Block IP in Cloudflare
2. Block IP in Nginx
3. Enable Cloudflare security features
4. Monitor for future attacks

**Long-term Actions**:
1. Fix underlying vulnerability
2. Implement comprehensive security
3. Set up monitoring and alerts
4. Regular security audits

---

**Note**: Once Cloudflare is fully active, you'll have much better visibility into attacks through the Security Events dashboard. This will show you all attack attempts, blocked requests, and threat patterns in real-time.

