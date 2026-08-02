package com.slss.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 启动期对敏感配置做 fail-fast 校验：拒绝使用默认占位值，
 * 避免生产环境误用 change-me/change-this 等不安全配置。
 */
@Component
public class SecretValidationCheck {

    @Value("${jdbc.password:}") String jdbcPassword;
    @Value("${slss.security.report-download-secret:}") String reportDownloadSecret;

    @PostConstruct
    void validate() {
        if (jdbcPassword == null || jdbcPassword.isBlank() || jdbcPassword.equals("change-me")) {
            throw new IllegalStateException("jdbc.password 未配置或仍为默认值 change-me，拒绝启动");
        }
        if (reportDownloadSecret == null || reportDownloadSecret.isBlank()
                || reportDownloadSecret.startsWith("change-this")) {
            throw new IllegalStateException("slss.security.report-download-secret 未配置或仍为默认占位值，拒绝启动");
        }
    }
}
