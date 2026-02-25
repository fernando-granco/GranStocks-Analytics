export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

export const isSuperAdmin = (role: string | undefined | null): boolean => {
    return role === 'SUPERADMIN';
};

export const isAdmin = (role: string | undefined | null): boolean => {
    return role === 'ADMIN' || role === 'SUPERADMIN';
};
