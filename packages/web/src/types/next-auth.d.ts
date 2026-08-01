import 'next-auth';

declare module 'next-auth' {
  interface Session {
    userId?: string;
  }

  interface User {
    dbToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    dbToken?: string;
  }
}
