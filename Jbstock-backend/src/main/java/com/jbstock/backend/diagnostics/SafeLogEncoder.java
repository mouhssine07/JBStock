package com.jbstock.backend.diagnostics;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.encoder.EncoderBase;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Set;

/** Deliberately excludes arbitrary messages, arguments, MDC and exception messages. */
public class SafeLogEncoder extends EncoderBase<ILoggingEvent> {
    private static final Set<String> EVENTS = Set.of("LOGGING_READY", "BACKEND_READY", "BACKEND_STOPPING", "LOGGING_STOPPED");
    private static final Set<String> DATABASE_EVENTS = Set.of("SQLITE_BUSY", "SQLITE_READONLY", "SQLITE_IOERR",
            "SQLITE_CORRUPT", "SQLITE_FULL", "SQLITE_CANTOPEN", "SQLITE_NOTADB", "SQLITE_OTHER", "DATABASE_FAILURE", "DATABASE_OPEN_RETRY");

    @Override public byte[] headerBytes() { return new byte[0]; }
    @Override public byte[] footerBytes() { return new byte[0]; }

    @Override public byte[] encode(ILoggingEvent event) {
        String code = "TECHNICAL_EVENT";
        if ("com.jbstock.lifecycle".equals(event.getLoggerName()) && event.getMessage() != null && EVENTS.contains(event.getMessage())) {
            code = event.getMessage();
        }
        if ("com.jbstock.database".equals(event.getLoggerName()) && event.getMessage() != null && DATABASE_EVENTS.contains(event.getMessage())) {
            code = event.getMessage();
        }
        StringBuilder line = new StringBuilder().append(Instant.ofEpochMilli(event.getTimeStamp()))
                .append(' ').append(event.getLevel()).append(' ').append(event.getLoggerName())
                .append(' ').append(code).append('\n');
        // Stack locations remain useful for diagnosis, without printing SQL, parameters or credentials.
        var throwable = event.getThrowableProxy();
        for (int cause = 0; throwable != null && cause < 8; cause++, throwable = throwable.getCause()) {
            line.append("cause=").append(throwable.getClassName()).append('\n');
            var frames = throwable.getStackTraceElementProxyArray();
            for (int i = 0; frames != null && i < Math.min(frames.length, 20); i++) {
                var frame = frames[i].getStackTraceElement();
                line.append(" at ").append(frame.getClassName()).append('.').append(frame.getMethodName())
                        .append(':').append(frame.getLineNumber()).append('\n');
            }
        }
        return line.toString().getBytes(StandardCharsets.UTF_8);
    }
}
