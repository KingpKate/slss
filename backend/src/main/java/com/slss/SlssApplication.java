package com.slss;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
@org.springframework.scheduling.annotation.EnableAsync
public class SlssApplication extends SpringBootServletInitializer {
  public static void main(String[] args) { SpringApplication.run(SlssApplication.class, args); }
  @Override protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) { return builder.sources(SlssApplication.class); }
}
