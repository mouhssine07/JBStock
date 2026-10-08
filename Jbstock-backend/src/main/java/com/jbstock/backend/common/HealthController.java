package com.jbstock.backend.common;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Desktop entry point; Actuator remains responsible for health checks and HTTP status. */
@Controller
public class HealthController {
    @GetMapping("/health")
    public String health() {
        return "forward:/actuator/health";
    }
}
