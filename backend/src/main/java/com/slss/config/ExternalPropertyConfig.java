package com.slss.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.context.annotation.PropertySources;

/**
 * Loads packaged defaults first and persistent Tomcat configuration last.
 * The external files therefore override values shipped inside the WAR.
 */
@Configuration
@PropertySources({
    @PropertySource(value = "classpath:jdbc.properties", ignoreResourceNotFound = true),
    @PropertySource(value = "classpath:security.properties", ignoreResourceNotFound = true),
    @PropertySource(value = "classpath:queue.properties", ignoreResourceNotFound = true),
    @PropertySource(value = "file:${catalina.base}/conf/slss/jdbc.properties", ignoreResourceNotFound = true),
    @PropertySource(value = "file:${catalina.base}/conf/slss/security.properties", ignoreResourceNotFound = true),
    @PropertySource(value = "file:${catalina.base}/conf/slss/queue.properties", ignoreResourceNotFound = true)
})
public class ExternalPropertyConfig {
}
