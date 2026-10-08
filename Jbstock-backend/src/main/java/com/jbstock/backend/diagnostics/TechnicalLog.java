package com.jbstock.backend.diagnostics;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.rolling.RollingFileAppender;
import ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy;
import ch.qos.logback.core.util.FileSize;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.nio.file.Path;

/** Owned by the application context, so file handles are closed with the backend. */
public final class TechnicalLog implements AutoCloseable {
    private final LoggerContext context;
    private final RollingFileAppender<ILoggingEvent> appender;
    private final SizeAndTimeBasedRollingPolicy<ILoggingEvent> policy;

    public TechnicalLog(Path directory) throws IOException {
        this((LoggerContext) LoggerFactory.getILoggerFactory(), directory, FileSize.valueOf("10MB"));
    }

    public TechnicalLog(LoggerContext context, Path directory, FileSize maxFileSize) throws IOException {
        this.context = context;
        var file = directory.resolve("jbstock.log");
        // Fail explicitly instead of silently running without the requested file log.
        try (var ignored = java.nio.file.Files.newOutputStream(file,
                java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND)) { }
        appender = new RollingFileAppender<>();
        appender.setContext(context);
        appender.setName("JBSTOCK_FILE_" + System.identityHashCode(this));
        appender.setFile(file.toString());
        var encoder = new SafeLogEncoder();
        encoder.setContext(context);
        encoder.start();
        appender.setEncoder(encoder);
        policy = new SizeAndTimeBasedRollingPolicy<>();
        policy.setContext(context);
        policy.setParent(appender);
        policy.setFileNamePattern(directory.resolve("jbstock-%d{yyyy-MM-dd}.%i.log.gz").toString());
        policy.setMaxFileSize(maxFileSize);
        policy.setMaxHistory(14);
        policy.setTotalSizeCap(FileSize.valueOf("100MB"));
        policy.setCleanHistoryOnStart(true);
        policy.start();
        appender.setRollingPolicy(policy);
        appender.setTriggeringPolicy(policy);
        appender.start();
        if (!appender.isStarted()) {
            appender.stop();
            policy.stop();
            throw new IOException("Unable to initialize the technical log.");
        }
        context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).addAppender(appender);
        context.getLogger("com.jbstock.lifecycle").info("LOGGING_READY");
    }

    @Override public void close() {
        context.getLogger("com.jbstock.lifecycle").info("LOGGING_STOPPED");
        context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).detachAppender(appender);
        appender.stop();
        policy.stop();
    }
}
