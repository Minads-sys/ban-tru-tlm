import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import '@/lib/auth-types';
import { removeVietnameseTones } from '@/lib/utils';
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-log';

export class CustomAuthError extends CredentialsSignin {
  code: string;
  constructor(code: string) {
    super();
    this.code = code;
  }
}

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
          if (verificationCode) {
            throw new CustomAuthError('STUDENT_NOT_FOUND');
          }
          return null;
        }

        // Validate verificationCode if provided for student
        if (verificationCode && user.student) {
          if (!user.student.studentCode.endsWith(verificationCode)) {
            log('vCode mismatch on selected user');
            throw new CustomAuthError('STUDENT_NOT_FOUND');
          }
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        log(`isPasswordValid: ${isPasswordValid}`);
        if (!isPasswordValid) {
          if (verificationCode) {
            // Check if user has changed password
            let daysAgo: number | null = null;
            if (user.passwordChangedAt) {
              const diffTime = Math.max(0, Date.now() - new Date(user.passwordChangedAt).getTime());
              daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else if (!user.requiresPasswordChange && user.updatedAt) {
              // Fallback if passwordChangedAt not yet set but requiresPasswordChange is false
              const diffTime = Math.max(0, Date.now() - new Date(user.updatedAt).getTime());
              daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }

            if (daysAgo !== null) {
              throw new CustomAuthError(`PASSWORD_INCORRECT_DAYS_${daysAgo}`);
            } else {
              throw new CustomAuthError('PASSWORD_INCORRECT_DEFAULT');
            }
          }
          return null;
        }

        // Kiểm tra trạng thái tài khoản
        if (user.role === 'STUDENT' && user.student) {
          if (!user.isActive || user.student.boardingStatus === 'CANCELLED') {
            // Kiểm tra xem học sinh có hóa đơn nào còn nợ (UNPAID hoặc PARTIAL) không
            const unpaidBill = await prisma.monthlyBill.findFirst({
              where: {
                studentId: user.student.id,
                paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
              },
            });

            if (!unpaidBill) {
              if (user.student.boardingStatus === 'CANCELLED') {
                throw new CustomAuthError('ACCOUNT_CANCELLED_NO_DEBT');
              } else {
                throw new CustomAuthError('ACCOUNT_INACTIVE');
              }
            }
            // Còn nợ -> Cho phép đăng nhập để xem thông tin quyết toán và quét mã QR thanh toán
          }
        } else if (!user.isActive) {
          throw new CustomAuthError('ACCOUNT_INACTIVE');
        }

        if (user.role !== 'STUDENT') {
          logAudit({
            userId: user.id,
            userName: user.fullName || user.username,
            userRole: user.role,
            action: AUDIT_ACTIONS.LOGIN,
            module: AUDIT_MODULES.AUTH,
            description: `Người dùng ${user.fullName} (${user.username}) đăng nhập hệ thống quản lý`,
          });
        }

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          studentId: user.student?.id,
          studentCode: user.student?.studentCode,
          requiresPasswordChange: user.requiresPasswordChange,
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
        token.requiresPasswordChange = user.requiresPasswordChange;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'TEACHER' | 'STUDENT' | 'BOARDING_MANAGER' | 'BOARDING_STAFF' | 'CASHIER' | 'ACCOUNTANT';
        session.user.permissions = token.permissions as string[];
        session.user.studentId = token.studentId as string | undefined;
        session.user.studentCode = token.studentCode as string | undefined;
        session.user.requiresPasswordChange = token.requiresPasswordChange as boolean | undefined;
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
