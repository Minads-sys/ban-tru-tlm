import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import '@/lib/auth-types';
import { removeVietnameseTones } from '@/lib/utils';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
        verificationCode: { label: 'Mã xác nhận', type: 'text' },
      },
      async authorize(credentials) {
        const fs = require('fs');
        const log = (msg: string) => {
          try { fs.appendFileSync('debug_login.txt', new Date().toISOString() + ' - ' + msg + '\n'); } catch (e) {}
        };
        log(`Login attempt for: ${credentials?.username}`);

        if (!credentials?.username || !credentials?.password) {
          log('Missing username or password');
          return null;
        }

        const username = (credentials.username as string).trim();
        const password = (credentials.password as string).trim();
        const verificationCode = credentials.verificationCode 
          ? (credentials.verificationCode as string).trim() 
          : undefined;

        log(`Parsed - username: "${username}", passLen: ${password.length}, vCode: "${verificationCode}"`);

        if (!username || !password) {
          return null;
        }

        // Standard username query first
        let user = await prisma.user.findUnique({
          where: { username: username.toLowerCase() },
          include: { student: true },
        });
        log(`findUnique by username: ${!!user}`);

        // If not found and verificationCode is provided, search by normalized username + studentCode ending with verificationCode
        if (!user && verificationCode) {
          const matchingUsers = await prisma.user.findMany({
            where: {
              role: 'STUDENT',
              student: {
                studentCode: {
                  endsWith: verificationCode,
                },
              },
            },
            include: { student: true },
          });
          log(`Fallback query found ${matchingUsers.length} users with vCode ${verificationCode}`);

          // Filter by full name match
          const normalizedInput = removeVietnameseTones(username).replace(/\s+/g, '').toLowerCase();
          log(`Normalized input name: "${normalizedInput}"`);
          user = matchingUsers.find((u) => {
            const normalizedFullName = removeVietnameseTones(u.fullName).replace(/\s+/g, '').toLowerCase();
            return normalizedFullName === normalizedInput;
          }) || null;
          log(`Fallback name match: ${!!user}, matched username: ${user?.username}`);
        }

        if (!user || !user.passwordHash) {
          log('User still null or no password hash');
          return null;
        }

        // Validate verificationCode if provided for student
        if (verificationCode && user.student) {
          if (!user.student.studentCode.endsWith(verificationCode)) {
            log('vCode mismatch on selected user');
            throw new Error('Mã xác nhận (6 số cuối Mã học sinh) không chính xác');
          }
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        log(`isPasswordValid: ${isPasswordValid}`);
        if (!isPasswordValid) {
          return null;
        }

        if (!user.isActive) {
          throw new Error('Tài khoản bán trú của bạn đã bị ngưng hoạt động');
        }

        if (user.role === 'STUDENT' && user.student?.boardingStatus === 'CANCELLED') {
          throw new Error('Tài khoản bán trú của bạn đã bị ngưng hoạt động');
        }

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          studentId: user.student?.id,
          studentCode: user.student?.studentCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.permissions = user.permissions;
        token.studentId = user.studentId;
        token.studentCode = user.studentCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'TEACHER' | 'STUDENT' | 'BOARDING_MANAGER' | 'BOARDING_STAFF';
        session.user.permissions = token.permissions as string[];
        session.user.studentId = token.studentId as string | undefined;
        session.user.studentCode = token.studentCode as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
});
