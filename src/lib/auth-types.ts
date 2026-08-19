import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'BOARDING_MANAGER' | 'BOARDING_STAFF';
      permissions?: string[];
      studentId?: string;
      studentCode?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'BOARDING_MANAGER' | 'BOARDING_STAFF';
    permissions?: string[];
    studentId?: string;
    studentCode?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'BOARDING_MANAGER' | 'BOARDING_STAFF';
    permissions?: string[];
    studentId?: string;
    studentCode?: string;
  }
}
