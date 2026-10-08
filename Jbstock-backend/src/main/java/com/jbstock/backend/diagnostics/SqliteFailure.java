package com.jbstock.backend.diagnostics;

/** Whitelisted SQLite result codes only: no paths, SQL or exception messages. */
public final class SqliteFailure {
    private SqliteFailure() { }

    public static boolean mayBeTransient(Throwable failure) {
        String result = code(failure);
        return result.equals("SQLITE_BUSY") || result.equals("SQLITE_CANTOPEN");
    }

    public static String code(Throwable failure) {
        for (int i = 0; failure != null && i < 32; i++, failure = failure.getCause()) {
            if (failure instanceof org.sqlite.SQLiteException sqlite) {
                // Extended SQLite result codes retain the primary code in their low byte.
                return switch (sqlite.getErrorCode() & 0xff) {
                    case 5, 6 -> "SQLITE_BUSY";
                    case 8 -> "SQLITE_READONLY";
                    case 10 -> "SQLITE_IOERR";
                    case 11 -> "SQLITE_CORRUPT";
                    case 13 -> "SQLITE_FULL";
                    case 14 -> "SQLITE_CANTOPEN";
                    case 26 -> "SQLITE_NOTADB";
                    default -> "SQLITE_OTHER";
                };
            }
        }
        return "DATABASE_FAILURE";
    }
}
