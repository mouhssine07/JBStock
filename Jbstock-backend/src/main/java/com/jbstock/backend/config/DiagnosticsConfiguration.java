package com.jbstock.backend.config;

import com.jbstock.backend.diagnostics.TechnicalLog;
import com.jbstock.backend.storage.LocalStorage;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.io.IOException;

@Configuration(proxyBeanMethods = false)
public class DiagnosticsConfiguration {
    @Bean
    TechnicalLog technicalLog(LocalStorage storage) throws IOException {
        return new TechnicalLog(storage.root().resolve("logs"));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ready(ApplicationReadyEvent event) {
        LoggerFactory.getLogger("com.jbstock.lifecycle").info("BACKEND_READY");
        Integer port = event.getApplicationContext().getEnvironment().getProperty("local.server.port", Integer.class);
        if (port != null) System.out.println("JBSTOCK_READY " + port);
    }

    @EventListener(ContextClosedEvent.class)
    public void stopping() { LoggerFactory.getLogger("com.jbstock.lifecycle").info("BACKEND_STOPPING"); }
}
