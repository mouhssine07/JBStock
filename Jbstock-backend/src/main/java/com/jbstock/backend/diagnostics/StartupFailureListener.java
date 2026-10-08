package com.jbstock.backend.diagnostics;

import org.springframework.boot.context.event.ApplicationFailedEvent;
import org.springframework.context.ApplicationListener;

/** Stable stderr contract for a launcher, including failures before a file log is available. */
public final class StartupFailureListener implements ApplicationListener<ApplicationFailedEvent> {
    @Override public void onApplicationEvent(ApplicationFailedEvent event) {
        System.err.println("JBSTOCK_STARTUP_FAILED " + classify(event.getException()));
    }

    public static String classify(Throwable failure) {
        String code = "STARTUP_ERROR";
        for (int i = 0; failure != null && i < 32; i++, failure = failure.getCause()) {
            if (failure instanceof org.flywaydb.core.api.FlywayException) return "MIGRATION_ERROR";
            if (failure instanceof java.sql.SQLException) code = "DATABASE_ERROR";
            else if (failure instanceof java.io.IOException && !code.equals("DATABASE_ERROR")) code = "STORAGE_ERROR";
        }
        return code;
    }
}
