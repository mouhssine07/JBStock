package com.jbstock.backend.diagnostics;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;

class MainProcessTests {
    @TempDir Path root;

    @Test
    void realMainExitsWithSafeDiagnosticAndDoesNotPrintInvalidSecret() throws Exception {
        Path output = root.resolve("process-output.txt");
        String executable = System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java";
        var builder = new ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", executable).toString(),
                "-cp", System.getProperty("java.class.path"), "com.jbstock.backend.JbstockApplication",
                "--server.port=0", "--jbstock.storage.home=" + root,
                "--jbstock.storage.database-path=", "--spring.datasource.url=");
        builder.environment().put("JBSTOCK_LOCAL_SESSION_TOKEN", "PRIVATE-INVALID-SECRET");
        builder.redirectErrorStream(true).redirectOutput(output.toFile());
        var process = builder.start();
        try {
            assertThat(process.waitFor(45, TimeUnit.SECONDS)).isTrue();
            assertThat(process.exitValue()).isEqualTo(1);
            assertThat(Files.readString(output)).contains("JBSTOCK_STARTUP_FAILED STARTUP_ERROR")
                    .doesNotContain("PRIVATE-INVALID-SECRET", "Exception in thread");
        } finally {
            if (process.isAlive()) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
            }
        }
    }
}
