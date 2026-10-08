package com.jbstock.backend.diagnostics;

import com.jbstock.backend.JbstockApplication;
import jakarta.servlet.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.ContextClosedEvent;
import java.nio.file.Path;
import java.net.URI;
import java.net.http.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

class GracefulShutdownTests {
    @TempDir Path root;

    @TestConfiguration(proxyBeanMethods = false)
    static class HoldConfiguration {
        @Bean Gate gate() { return new Gate(); }
        @Bean FilterRegistrationBean<Gate> holdRequest(Gate gate) {
            var registration = new FilterRegistrationBean<>(gate);
            registration.addUrlPatterns("/api/company");
            return registration;
        }
    }

    static class Gate implements Filter {
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        @Override public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws java.io.IOException, ServletException {
            entered.countDown();
            try {
                if (!release.await(10, TimeUnit.SECONDS)) throw new ServletException("Test gate timed out");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new ServletException(exception);
            }
            chain.doFilter(request, response);
        }
    }

    @Test
    void closingContextWaitsForActiveRequestAndReleasesDatabase() throws Exception {
        var context = new SpringApplicationBuilder(JbstockApplication.class, HoldConfiguration.class).run(
                "--server.port=0", "--jbstock.storage.home=" + root,
                "--jbstock.storage.database-path=", "--spring.datasource.url=",
                "--jbstock.security.local-session-token=" + "b".repeat(64));
        var gate = context.getBean(Gate.class);
        var datasource = context.getBean(com.zaxxer.hikari.HikariDataSource.class);
        var closing = new CountDownLatch(1);
        context.addApplicationListener(event -> { if (event instanceof ContextClosedEvent) closing.countDown(); });
        try (var executor = Executors.newSingleThreadExecutor(); var client = HttpClient.newHttpClient()) {
            int port = Integer.parseInt(context.getEnvironment().getProperty("local.server.port"));
            assertThat(context.getEnvironment().getProperty("spring.lifecycle.timeout-per-shutdown-phase")).isEqualTo("20s");
            var request = client.sendAsync(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/company"))
                    .header("X-JBStock-Local-Token", "b".repeat(64))
                    .timeout(java.time.Duration.ofSeconds(15)).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(gate.entered.await(5, TimeUnit.SECONDS)).isTrue();
            var stopped = executor.submit(context::close);
            assertThat(closing.await(5, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> stopped.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            gate.release.countDown();
            assertThat(request.get(5, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
            stopped.get(5, TimeUnit.SECONDS);
            assertThat(datasource.isClosed()).isTrue();
        } finally {
            gate.release.countDown();
            context.close();
        }
    }
}
