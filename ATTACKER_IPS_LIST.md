# Complete List of Attacker IPs

## 🔴 Confirmed Attackers (High Priority - Block Immediately)

These IPs have been confirmed to have:
- Executed malicious code
- Downloaded backdoors
- Attempted command injection
- Made suspicious POST requests to root endpoint

### Primary Attackers:

1. **45.76.155.14** ⚠️ **CRITICAL**
   - **Attacks**: Multiple POST requests to `/`
   - **User Agent**: `python-requests/2.28.1`
   - **Action**: Downloaded and executed `http://45.76.155.14/vim`
   - **Status**: Confirmed malicious
   - **Location**: Singapore (Vultr VPS)

2. **193.34.213.150** ⚠️ **CRITICAL**
   - **Attacks**: Attempted to download `http://193.34.213.150/nuts/bolts`
   - **Action**: Tried to execute malicious script via `busybox wget`
   - **Status**: Confirmed malicious
   - **Location**: Unknown

### Secondary Attackers (Suspicious POST to Root):

3. **78.153.140.93** ⚠️ **HIGH RISK**
   - **Attacks**: 55 POST requests to `/` (root endpoint)
   - **Status**: Highly suspicious - massive attack volume
   - **Action**: Block immediately

4. **78.153.140.147** ⚠️ **HIGH RISK**
   - **Attacks**: 39 POST requests to `/` (root endpoint)
   - **Status**: Highly suspicious - massive attack volume
   - **Action**: Block immediately

5. **104.233.177.98** ⚠️ **HIGH RISK**
   - **Attacks**: 29 POST requests to `/` (root endpoint)
   - **Status**: Highly suspicious
   - **Action**: Block immediately

6. **154.187.189.166** ⚠️ **HIGH RISK**
   - **Attacks**: Multiple POST requests to `/`
   - **User Agent**: `python-requests/2.28.1`
   - **Status**: Confirmed bot/scanner
   - **Action**: Block immediately

7. **95.214.52.170** ⚠️ **HIGH RISK**
   - **Attacks**: POST to `/` (returned HTTP 500)
   - **User Agent**: `Mozilla/5.0 (X11; Linux x86_64)`
   - **Status**: Suspicious
   - **Action**: Block immediately

### Additional Suspicious IPs:

8. **45.121.48.26**
   - **Attacks**: 8 POST requests to `/`
   - **Status**: Suspicious
   - **Action**: Block

9. **45.61.137.142**
   - **Attacks**: 6 POST requests to `/`
   - **User Agent**: `python-requests/2.28.1`
   - **Status**: Confirmed bot
   - **Action**: Block

10. **206.82.1.50**
    - **Attacks**: 6 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

11. **64.190.113.23**
    - **Attacks**: 3 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

12. **172.96.140.124**
    - **Attacks**: 3 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

13. **146.70.177.117**
    - **Attacks**: 3 POST requests to `/`
    - **User Agent**: `python-requests/2.28.1`
    - **Status**: Confirmed bot
    - **Action**: Block

14. **157.245.207.55**
    - **Attacks**: 2 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

15. **8.29.64.254**
    - **Attacks**: 2 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

16. **216.158.232.43**
    - **Attacks**: 2 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

17. **192.238.129.36**
    - **Attacks**: 2 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

18. **184.105.247.194**
    - **Attacks**: 2 POST requests to `/`
    - **Status**: Suspicious
    - **Action**: Block

19. **66.135.2.109**
    - **Attacks**: 1 POST request to `/`
    - **Status**: Suspicious
    - **Action**: Block

20. **64.227.32.66**
    - **Attacks**: 1 POST request to `/`
    - **Status**: Suspicious
    - **Action**: Block

---

## 📋 Complete IP List for Cloudflare Blocking

### Copy-Paste List (One per line):

```
45.76.155.14
193.34.213.150
78.153.140.93
78.153.140.147
104.233.177.98
154.187.189.166
95.214.52.170
45.121.48.26
45.61.137.142
206.82.1.50
64.190.113.23
172.96.140.124
146.70.177.117
157.245.207.55
8.29.64.254
216.158.232.43
192.238.129.36
184.105.247.194
66.135.2.109
64.227.32.66
```

### Top 10 Most Dangerous (Block First):

```
45.76.155.14
193.34.213.150
78.153.140.93
78.153.140.147
104.233.177.98
154.187.189.166
95.214.52.170
45.121.48.26
45.61.137.142
206.82.1.50
```

---

## 🛡️ How to Block in Cloudflare

### Method 1: IP Access Rules (Recommended)

1. Go to: **Security** → **WAF** → **Tools** → **IP Access Rules**
2. For each IP, click **"Add"**:
   - Enter IP address
   - Action: **Block**
   - Note: "Attacker from security incident"
   - Click **"Add"**

### Method 2: Firewall Rules (Bulk Block)

1. Go to: **Security** → **WAF** → **Firewall Rules**
2. Click **"+ Create rule"**
3. Configure:
   - **Rule name**: "Block All Known Attackers"
   - **Expression**: 
     ```
     (ip.src in {45.76.155.14 193.34.213.150 78.153.140.93 78.153.140.147 104.233.177.98 154.187.189.166 95.214.52.170 45.121.48.26 45.61.137.142 206.82.1.50})
     ```
   - **Action**: **Block**
   - Click **"Deploy"**

**Note**: Free plan allows up to 5 custom rules, so you may need to combine IPs into one rule using the `in` operator.

---

## 📊 Attack Statistics

- **Total Unique Attackers**: 20+ IPs
- **Total Attack Attempts**: 200+ POST requests to root endpoint
- **Most Active Attacker**: 78.153.140.93 (55 attacks)
- **Confirmed Malicious**: 2 IPs (45.76.155.14, 193.34.213.150)
- **Bot Scanners**: Multiple IPs using `python-requests/2.28.1`

---

## ⚠️ Important Notes

1. **Cloudflare IPs**: Some IPs starting with `172.69`, `172.71`, `104.22`, `162.158` are Cloudflare IPs - **DO NOT BLOCK** these
2. **Legitimate Traffic**: Some POST requests to `/api/*` endpoints are legitimate - only block POST to root `/`
3. **Ongoing Attacks**: New attacker IPs may appear - monitor Security Events dashboard regularly

---

## 🔄 Monitoring

After blocking, monitor:
- **Security** → **Events** dashboard
- Look for new attacker IPs
- Check blocked request counts
- Review false positives

---

**Total IPs to Block: 20**

**Priority**: Block the top 10 immediately, then add the rest.

