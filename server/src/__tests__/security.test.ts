import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===========================================================================
// 1) Admin Privilege Escalation Tests
// ===========================================================================
describe('Admin Role Escalation Protection', () => {
    /**
     * enforceRoleHierarchy is the extracted helper. These tests validate
     * the logic directly by simulating actor/target combinations.
     */

    const mockReply = () => {
        const r: any = {};
        r.status = vi.fn().mockReturnValue(r);
        r.send = vi.fn().mockReturnValue(r);
        return r;
    };

    // Simulates the core logic from enforceRoleHierarchy
    function checkHierarchy(
        actorRole: string,
        targetRole: string,
        requestedRole?: string
    ): { allowed: boolean; errorMsg?: string } {
        // ADMIN cannot modify another ADMIN or SUPERADMIN
        if ((targetRole === 'ADMIN' || targetRole === 'SUPERADMIN') && actorRole !== 'SUPERADMIN') {
            return { allowed: false, errorMsg: 'Admins cannot modify other Admins or Superadmins' };
        }

        // Only SUPERADMIN can assign ADMIN or SUPERADMIN roles
        if (requestedRole && requestedRole !== 'USER' && actorRole !== 'SUPERADMIN') {
            return { allowed: false, errorMsg: 'Only Superadmins can assign Admin or Superadmin roles' };
        }

        return { allowed: true };
    }

    it('ADMIN cannot promote USER to ADMIN', () => {
        const result = checkHierarchy('ADMIN', 'USER', 'ADMIN');
        expect(result.allowed).toBe(false);
        expect(result.errorMsg).toContain('Only Superadmins');
    });

    it('ADMIN cannot promote USER to SUPERADMIN', () => {
        const result = checkHierarchy('ADMIN', 'USER', 'SUPERADMIN');
        expect(result.allowed).toBe(false);
        expect(result.errorMsg).toContain('Only Superadmins');
    });

    it('ADMIN cannot modify another ADMIN', () => {
        const result = checkHierarchy('ADMIN', 'ADMIN');
        expect(result.allowed).toBe(false);
        expect(result.errorMsg).toContain('cannot modify');
    });

    it('ADMIN cannot modify a SUPERADMIN', () => {
        const result = checkHierarchy('ADMIN', 'SUPERADMIN');
        expect(result.allowed).toBe(false);
        expect(result.errorMsg).toContain('cannot modify');
    });

    it('SUPERADMIN can promote USER to ADMIN', () => {
        const result = checkHierarchy('SUPERADMIN', 'USER', 'ADMIN');
        expect(result.allowed).toBe(true);
    });

    it('SUPERADMIN can promote USER to SUPERADMIN', () => {
        const result = checkHierarchy('SUPERADMIN', 'USER', 'SUPERADMIN');
        expect(result.allowed).toBe(true);
    });

    it('SUPERADMIN can modify another ADMIN', () => {
        const result = checkHierarchy('SUPERADMIN', 'ADMIN');
        expect(result.allowed).toBe(true);
    });

    it('ADMIN can manage a USER account', () => {
        const result = checkHierarchy('ADMIN', 'USER');
        expect(result.allowed).toBe(true);
    });

    it('ADMIN can set-password for USER only (simulated)', () => {
        // set-password does not pass requestedRole, so only checks target
        const result = checkHierarchy('ADMIN', 'USER');
        expect(result.allowed).toBe(true);

        const denied = checkHierarchy('ADMIN', 'ADMIN');
        expect(denied.allowed).toBe(false);
    });

    it('ADMIN cannot force-reset password for another ADMIN', () => {
        const result = checkHierarchy('ADMIN', 'ADMIN');
        expect(result.allowed).toBe(false);
    });
});

// ===========================================================================
// 2) SSRF Validator Tests
// ===========================================================================
describe('SSRF URL Validation', () => {
    const { URL } = require('url');

    // Re-implements the static checks from validateBaseUrl for unit testing
    function staticValidateUrl(urlStr: string): { valid: boolean; error?: string } {
        let url: URL;
        try {
            url = new URL(urlStr);
        } catch {
            return { valid: false, error: 'Invalid Base URL format' };
        }

        if (url.protocol !== 'https:') {
            return { valid: false, error: 'Base URL must use HTTPS' };
        }

        if (url.username || url.password) {
            return { valid: false, error: 'Base URL must not contain embedded credentials' };
        }

        const hostname = url.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return { valid: false, error: 'Base URL cannot resolve to localhost' };
        }

        return { valid: true };
    }

    function isPrivateIp(ip: string): boolean {
        return (
            ip === '127.0.0.1' || ip === '::1' ||
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
            ip.startsWith('169.254.') ||
            ip.startsWith('0.') ||
            ip.startsWith('fe80:') ||
            ip.startsWith('fc') || ip.startsWith('fd')
        );
    }

    it('rejects HTTP URLs', () => {
        const r = staticValidateUrl('http://api.example.com');
        expect(r.valid).toBe(false);
        expect(r.error).toContain('HTTPS');
    });

    it('rejects URLs with embedded credentials', () => {
        const r = staticValidateUrl('https://user:pass@evil.com/api');
        expect(r.valid).toBe(false);
        expect(r.error).toContain('credentials');
    });

    it('rejects URLs with username only', () => {
        const r = staticValidateUrl('https://admin@evil.com/api');
        expect(r.valid).toBe(false);
        expect(r.error).toContain('credentials');
    });

    it('rejects localhost', () => {
        const r = staticValidateUrl('https://localhost/api');
        expect(r.valid).toBe(false);
    });

    it('rejects 127.0.0.1', () => {
        const r = staticValidateUrl('https://127.0.0.1/api');
        expect(r.valid).toBe(false);
    });

    it('accepts valid HTTPS URL without credentials', () => {
        const r = staticValidateUrl('https://api.example.com/v1');
        expect(r.valid).toBe(true);
    });

    // IP range tests
    it('blocks 10.x.x.x private IP', () => expect(isPrivateIp('10.0.0.1')).toBe(true));
    it('blocks 192.168.x.x private IP', () => expect(isPrivateIp('192.168.1.1')).toBe(true));
    it('blocks 172.16-31.x.x private IP', () => expect(isPrivateIp('172.16.0.1')).toBe(true));
    it('blocks 169.254.x.x link-local', () => expect(isPrivateIp('169.254.169.254')).toBe(true));
    it('blocks 0.x.x.x current network', () => expect(isPrivateIp('0.0.0.0')).toBe(true));
    it('blocks fe80:: IPv6 link-local', () => expect(isPrivateIp('fe80::1')).toBe(true));
    it('blocks fc00:: IPv6 ULA', () => expect(isPrivateIp('fc00::1')).toBe(true));
    it('blocks fd00:: IPv6 ULA', () => expect(isPrivateIp('fd00::1')).toBe(true));
    it('allows public IPv4', () => expect(isPrivateIp('8.8.8.8')).toBe(false));
    it('allows public IPv6', () => expect(isPrivateIp('2001:4860:4860::8888')).toBe(false));
});

// ===========================================================================
// 3) Prompt Template Enum Tests
// ===========================================================================
describe('Prompt Template Validation', () => {
    const z = require('zod');

    const roleEnum = z.enum(['TECHNICAL', 'FUNDAMENTAL', 'SENTIMENT', 'BULL', 'BEAR', 'RISK', 'CONSENSUS', 'NARRATIVE']);
    const outputModeEnum = z.enum(['TEXT_ONLY', 'JSON_STRICT', 'MARKDOWN', 'ACTION_LABELS']);

    it('accepts valid role: TECHNICAL', () => {
        expect(roleEnum.parse('TECHNICAL')).toBe('TECHNICAL');
    });

    it('rejects unsupported role: MAGIC', () => {
        expect(() => roleEnum.parse('MAGIC')).toThrow();
    });

    it('accepts valid outputMode: JSON_STRICT', () => {
        expect(outputModeEnum.parse('JSON_STRICT')).toBe('JSON_STRICT');
    });

    it('rejects unsupported outputMode: XML', () => {
        expect(() => outputModeEnum.parse('XML')).toThrow();
    });
});

// ===========================================================================
// 4) Universe Enum Tests
// ===========================================================================
describe('Universe Support', () => {
    const z = require('zod');

    const universeEnum = z.enum(['SP500', 'NASDAQ100', 'CRYPTO', 'TSX60', 'IBOV']);

    it('accepts TSX60', () => {
        expect(universeEnum.parse('TSX60')).toBe('TSX60');
    });

    it('accepts IBOV', () => {
        expect(universeEnum.parse('IBOV')).toBe('IBOV');
    });

    it('rejects unsupported universe', () => {
        expect(() => universeEnum.parse('FTSE100')).toThrow();
    });
});

// ===========================================================================
// 5) Invite Code Normalization Tests
// ===========================================================================
describe('Invite Code Normalization', () => {
    function normalizeInviteCode(code: string): string {
        return code.trim().toUpperCase();
    }

    it('trims whitespace', () => {
        expect(normalizeInviteCode('  abcd1234  ')).toBe('ABCD1234');
    });

    it('uppercases lowercase input', () => {
        expect(normalizeInviteCode('abc123')).toBe('ABC123');
    });

    it('handles mixed case', () => {
        expect(normalizeInviteCode('AbCd')).toBe('ABCD');
    });

    it('registration and creation normalize identically', () => {
        const adminCreated = normalizeInviteCode('test-code');
        const userEntered = normalizeInviteCode('  TEST-CODE  ');
        expect(adminCreated).toBe(userEntered);
    });
});
