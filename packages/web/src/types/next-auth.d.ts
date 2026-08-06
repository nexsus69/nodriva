import 'next-auth';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    activitySessionId?: string;
  }

  interface User {
    dbToken?: string;
    dbSessionId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    dbToken?: string;
    dbSessionId?: string;
  }
}
