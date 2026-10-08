package com.jbstock.backend.desktop;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/** Private inherited pipe, never an HTTP endpoint. Enabled only by the desktop launcher. */
@Component
@ConditionalOnProperty(name = "jbstock.desktop.stdin-control", havingValue = "true")
public class DesktopControl {
    @EventListener(ApplicationReadyEvent.class)
    public void ready(ApplicationReadyEvent event) {
        Thread.ofPlatform().daemon().name("desktop-control").start(() -> {
            try {
                var input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
                String line;
                while ((line = input.readLine()) != null) {
                    if (line.equals("JBSTOCK_SHUTDOWN")) break;
                }
            } catch (java.io.IOException ignored) {
                // Losing the parent pipe is also a request to shut down.
            } finally {
                event.getApplicationContext().close();
            }
        });
    }
}
