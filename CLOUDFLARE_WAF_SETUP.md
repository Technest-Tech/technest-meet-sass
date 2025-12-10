# How to Enable Cloudflare WAF - Step by Step Guide

## Quick Steps to Enable WAF

### Step 1: Log into Cloudflare Dashboard
1. Go to: https://dash.cloudflare.com
2. Log in with your account
3. Select your domain: `almajdmeet.org`

### Step 2: Enable Web Application Firewall (WAF)

**Path**: Security → WAF

1. In the left sidebar, click **"Security"**
2. Click **"WAF"** (Web Application Firewall)
3. You'll see WAF status - if it says "Off" or "Free plan", you need to enable it

**For Free Plan Users**:
- Free plan includes basic WAF
- Go to: **Security** → **WAF**
- Toggle **"Web Application Firewall"** to **ON**
- This enables managed rules

**For Pro Plan and Above**:
- More advanced WAF features available
- Custom rules and rate limiting
(ip.src in {45.76.155.14 193.34.213.150 78.153.140.93 78.153.140.147 104.233.177.98 154.187.189.166 95.214.52.170 45.121.48.26 45.61.137.142 206.82.1.50 64.190.113.23 172.96.140.124 146.70.177.117 157.245.207.55 8.29.64.254 216.158.232.43 192.238.129.36 184.105.247.194 66.135.2.109 64.227.32.66})
### Step 3: Enable Bot Fight Mode

**Path**: Security → Bots

1. Click **"Security"** in left sidebar
2. Click **"Bots"**
3. Find **"Bot Fight Mode"**
4. Toggle it to **"ON"**
5. This will challenge automated bots (like `python-requests/2.28.1`)

### Step 4: Block Known Attacker IPs

**Path**: Security → WAF → Tools → IP Access Rules

1. Go to: **Security** → **WAF** → **Tools**
2. Click **"IP Access Rules"**
3. Click **"Add"** button
4. Enter IP addresses to block:
   - `45.76.155.14` (first attacker)
   - `193.34.213.150` (second attacker)
   - `154.187.189.166` (third attacker)
   - `95.214.52.170` (fourth attacker)
5. Set **Action** to: **"Block"**
6. Add note: "Attackers from Dec 5, 2025 security incident"
7. Click **"Add"**

**Note**: You can add multiple IPs one by one, or use CIDR notation for IP ranges.

### Step 5: Create Firewall Rules (Advanced Protection)

**Path**: Security → WAF → Firewall Rules

1. Go to: **Security** → **WAF** → **Firewall Rules**
2. Click **"Create rule"**
3. Configure the rule:

**Rule 1: Block Bot User Agents**
- **Rule name**: "Block Python Requests Bot"
- **Expression**: `(http.user_agent eq "python-requests/2.28.1")`
- **Action**: Block
- Click **"Deploy"**

**Rule 2: Block POST to Root Endpoint**
- **Rule name**: "Block POST to Root"
- **Expression**: `(http.request.method eq "POST" and http.request.uri.path eq "/")`
- **Action**: Block
- Click **"Deploy"**

**Rule 3: Block Suspicious POST Patterns**
- **Rule name**: "Block Suspicious POST Requests"
- **Expression**: `(http.request.method eq "POST" and not http.request.uri.path.path matches "^/api/")`
- **Action**: Challenge (or Block)
- Click **"Deploy"**

### Step 6: Enable Rate Limiting (If Available)

**Path**: Security → WAF → Rate Limiting Rules

1. Go to: **Security** → **WAF** → **Rate Limiting Rules**
2. Click **"Create rule"**
3. Configure:
   - **Rule name**: "Limit POST Requests"
   - **Match**: `(http.request.method eq "POST")`
   - **Rate**: 10 requests per minute per IP
   - **Action**: Block
   - Click **"Deploy"**

### Step 7: Set Security Level

**Path**: Security → Settings

1. Go to: **Security** → **Settings**
2. Find **"Security Level"**
3. Set to: **"High"** (or at least "Medium")
4. This automatically challenges suspicious requests

### Step 8: Enable Challenge Passage

**Path**: Security → Settings

1. In **Security** → **Settings**
2. Find **"Challenge Passage"**
3. Set to: **30 minutes** (or your preference)
4. This allows legitimate users who pass challenges to continue

---

## Verification Checklist

After enabling WAF, verify:

- [ ] WAF is showing as "ON" in dashboard
- [ ] Bot Fight Mode is enabled
- [ ] Attacker IPs are blocked
- [ ] Firewall rules are deployed
- [ ] Security level is set to Medium or High

---

## Testing WAF Protection

### Test 1: Blocked Bot Request
```bash
curl -X POST https://almajdmeet.org \
  -H "User-Agent: python-requests/2.28.1" \
  -d "test=attack"
```

**Expected Result**: 
- HTTP 403 Forbidden
- Or HTTP 429 Too Many Requests
- Or Challenge page

### Test 2: Blocked Attacker IP
```bash
# From attacker IP (should be blocked)
curl -I https://almajdmeet.org
```

**Expected Result**: HTTP 403 Forbidden

### Test 3: Legitimate Request (Should Work)
```bash
curl -I https://almajdmeet.org
```

**Expected Result**: HTTP 200 OK

---

## Important Notes

1. **Free Plan Limitations**:
   - Basic WAF included
   - Limited custom rules
   - Bot Fight Mode available
   - Rate limiting may require Pro plan

2. **Pro Plan Benefits**:
   - Advanced WAF features
   - Custom firewall rules
   - Rate limiting
   - More bot protection options

3. **False Positives**:
   - Monitor Security Events dashboard
   - Adjust rules if legitimate traffic is blocked
   - Use "Challenge" instead of "Block" for uncertain cases

4. **Performance**:
   - WAF adds minimal latency (< 10ms typically)
   - Most requests are processed instantly
   - Only suspicious requests are challenged

---

## Monitoring Attacks

### View Security Events

**Path**: Security → Events

1. Go to: **Security** → **Events**
2. You'll see:
   - All blocked requests
   - Challenge responses
   - Attack patterns
   - IP addresses
   - Threat scores

### Set Up Alerts

**Path**: Notifications

1. Go to: **Notifications** (top right)
2. Create alert for:
   - Security events
   - High threat scores
   - DDoS attacks
   - WAF rule triggers

---

## Expected Results

Once WAF is enabled:

✅ **Automated bots blocked**: `python-requests/2.28.1` will be challenged/blocked
✅ **Attacker IPs blocked**: All known attacker IPs will be blocked
✅ **POST to root blocked**: Malicious POST requests to `/` will be blocked
✅ **Attack patterns detected**: WAF will identify and block common attack patterns
✅ **Real-time protection**: Attacks blocked before reaching your server

---

## Troubleshooting

### WAF Not Blocking Attacks

1. **Check WAF Status**: Ensure WAF is enabled
2. **Check Rules**: Verify firewall rules are deployed
3. **Check IP Blocks**: Verify IP access rules are active
4. **Check Security Level**: Ensure it's Medium or High
5. **Wait for Propagation**: Changes can take 1-2 minutes

### Legitimate Traffic Blocked

1. **Check Security Events**: See why it was blocked
2. **Adjust Rules**: Modify firewall rules to be less strict
3. **Whitelist IPs**: Add legitimate IPs to allowlist
4. **Use Challenge Instead of Block**: Challenge suspicious requests instead of blocking

### False Positives

1. Review Security Events dashboard
2. Identify patterns in false positives
3. Adjust firewall rules
4. Use "Challenge" action for uncertain cases

---

## Quick Reference

**Enable WAF**: Security → WAF → Toggle ON
**Enable Bot Fight**: Security → Bots → Bot Fight Mode → ON
**Block IPs**: Security → WAF → Tools → IP Access Rules
**Create Rules**: Security → WAF → Firewall Rules → Create rule
**View Events**: Security → Events
**Set Security Level**: Security → Settings → Security Level

---

**Once WAF is enabled, your server will be protected from these automated attacks!** 🛡️

